%% R&S FSWP measurement demo - MATLAB and plain SCPI
%
% Drives a Rohde & Schwarz FSWP phase noise analyzer over LAN with SCPI
% commands and nothing else: connect, configure a phase noise measurement,
% run it, read every result back (carrier frequency and level, spot noise,
% integrated noise, residual FM/PM, RMS jitter, the spur list and the full
% trace), plot it and save it. If the spectrum analyzer option R&S FSWP-B1
% is installed, a second part runs a spectrum sweep with a peak marker and
% a channel power measurement.
%
% Requirements
%   - MATLAB R2020b or newer. The default connection is a raw SCPI socket on
%     port 5025 through tcpclient, which is part of base MATLAB - no toolbox
%     is needed.
%   - Optional: Instrument Control Toolbox (R2021a or newer) if you prefer
%     VISA (HiSLIP or VXI-11). Put a VISA resource string in cfg.resource.
%   - An FSWP reachable over the network. Find its address under
%     SETUP > Network + Remote on the instrument.
%
% Run the whole file, or run it section by section with Ctrl+Enter. Every
% SCPI command is written out in full so the script doubles as a reference.
% Command syntax follows the R&S FSWP user manual, chapters "Remote commands
% for phase noise measurements" and "Remote commands for spectrum
% measurements"; the few commands that are not available on every firmware
% version are treated as optional and only produce a warning.
%
% The helper functions at the end of the file (scpiConnect, scpiQuery,
% scpiQueryNumbers, scpiRunSingle, scpiCheck, ...) are generic and can be
% lifted into your own scripts.

%% Settings - adapt these to your setup
cfg = struct();

% Instrument address. Either a hostname/IP (raw socket, port 5025) or a
% VISA resource string such as "TCPIP0::192.168.0.10::hislip0::INSTR".
cfg.resource = "192.168.0.10";

% Phase noise measurement
cfg.carrierHz        = 1e9;      % nominal carrier frequency of the DUT
cfg.autoSearch       = true;     % let the FSWP search for the signal itself
cfg.offsetStartHz    = 10;       % start offset - half-decade steps: 1, 3, 10, 30, ...
cfg.offsetStopHz     = 10e6;     % stop offset
cfg.sweepMode        = "NORMal"; % NORMal | FAST | AVERaged | MANual (see notes below)
cfg.xcorrFactor      = 10;       % cross-correlation factor (NORMal mode)
cfg.rbwPercent       = 10;       % RBW as a percentage of the offset (NORMal mode)
cfg.averages         = 1;        % number of measurements averaged (SWE:COUN)
cfg.smoothingPercent = 1;        % trace smoothing aperture in percent, 0 = off
cfg.spotOffsetsHz    = [1e3 20e3 100e3]; % custom spot noise points, up to 6
cfg.jitterRangeHz    = [10e3 1e6];       % user range for integrated results

% Spectrum measurement (needs R&S FSWP-B1)
cfg.spectrumDemo  = "auto";  % "auto" = run if B1 is installed | "on" | "off"
cfg.spanHz        = 10e6;
cfg.rbwHz         = 10e3;
cfg.refLevel_dBm  = 10;
cfg.chanBwHz      = 1e6;     % channel bandwidth for the channel power result

% Housekeeping
cfg.resetInstrument = true;  % *RST first, so the script starts from a known state
cfg.outputFolder    = fullfile(fileparts(mfilename('fullpath')), "results");

%% Connect and identify
fswp = scpiConnect(cfg.resource, 30);

idn  = scpiQuery(fswp, "*IDN?");
opts = scpiQuery(fswp, "*OPT?");
fprintf("Connected to: %s\n", idn);
fprintf("Options:      %s\n", opts);
if ~contains(idn, "FSWP", "IgnoreCase", true)
    warning("This does not look like an FSWP. Carrying on anyway.");
end

if cfg.resetInstrument
    scpiWrite(fswp, "*RST");   % preset: one 'Phase Noise' channel, CW measurement
    scpiWrite(fswp, "*CLS");   % clear the status registers and the error queue
    scpiQuery(fswp, "*OPC?");  % wait until the preset has finished
end

scpiWrite(fswp, "SYST:DISP:UPD ON");   % keep the screen updating while under remote control
scpiWrite(fswp, "FORM:DATA REAL,32");  % binary trace transfer (the helpers accept ASCII too)
scpiCheck(fswp, "connection and preset");

%% Configure the phase noise measurement
scpiWrite(fswp, "INST:SEL PNOise");    % the phase noise application is the active channel
scpiWrite(fswp, "INIT:CONT OFF");      % single measurements, so we can synchronise to the end

% Signal
scpiWrite(fswp, sprintf("SENS:FREQ:CENT %.12g", cfg.carrierHz));
scpiWrite(fswp, "SENS:ADJ:CONF:FREQ:AUT " + onOff(cfg.autoSearch)); % automatic signal search
% The search range can be narrowed with SENS:ADJ:CONF:FREQ:LIM:LOW / :HIGH
scpiWrite(fswp, "INP:ATT:AUTO ON");                                 % attenuation follows the signal level

% Offset range
scpiWrite(fswp, sprintf("SENS:FREQ:STAR %.12g", cfg.offsetStartHz));
scpiWrite(fswp, sprintf("SENS:FREQ:STOP %.12g", cfg.offsetStopHz));

% Half-decade table. NORMal lets the FSWP pick RBW and cross-correlations per
% half decade from two global factors; FAST and AVERaged are shortcuts for
% NORMal with 1 and 10 correlations. MANual configures each half decade <ri>
% separately, for example:
%   SENS:LIST:RANG<ri>:BWID:RES <percent>   RBW for that half decade
%   SENS:LIST:RANG<ri>:XCO <count>          cross-correlations for it
scpiWrite(fswp, "SENS:SWE:MODE " + cfg.sweepMode);
if strcmpi(cfg.sweepMode, "NORMal")
    scpiWrite(fswp, sprintf("SENS:SWE:XFAC %d", cfg.xcorrFactor));      % XCORR factor
    scpiWrite(fswp, sprintf("SENS:LIST:BWID:RAT %g", cfg.rbwPercent));  % RBW factor in %
end
scpiWrite(fswp, sprintf("SENS:SWE:COUN %d", cfg.averages));

% Trace smoothing on trace 1 of the noise diagram (window 1)
if cfg.smoothingPercent > 0
    scpiWrite(fswp, sprintf("DISP:WIND1:TRAC1:SMO:APER %g", cfg.smoothingPercent));
    scpiWrite(fswp, "DISP:WIND1:TRAC1:SMO:STAT ON");
else
    scpiWrite(fswp, "DISP:WIND1:TRAC1:SMO:STAT OFF");
end

% Spot noise: one value per decade, plus the custom offsets from cfg
scpiWrite(fswp, "CALC1:SNO:DEC:STAT ON");
for k = 1:numel(cfg.spotOffsetsHz)
    scpiWrite(fswp, sprintf("CALC1:SNO%d:X %.12g", k, cfg.spotOffsetsHz(k)));
    scpiWrite(fswp, sprintf("CALC1:SNO%d:STAT ON", k));
end

scpiCheck(fswp, "phase noise configuration");
fprintf("\nPhase noise measurement: %s carrier, %s to %s offset, %s mode\n", ...
    fmtHz(cfg.carrierHz), fmtHz(cfg.offsetStartHz), fmtHz(cfg.offsetStopHz), cfg.sweepMode);

%% Run the measurement
% SWE:DUR? estimates the measurement time. R&S recommends a remote timeout
% of twice that estimate plus a margin.
estimateS = scpiQueryNumber(fswp, "SENS:SWE:DUR?");
timeoutS  = max(60, 2 * estimateS + 30);
fprintf("Estimated duration %.1f s (timeout %.0f s)\n", estimateS, timeoutS);

tStart = tic;
scpiRunSingle(fswp, timeoutS, "phase noise measurement");
fprintf("Finished after %.1f s\n", toc(tStart));
scpiCheck(fswp, "phase noise measurement");

%% Read the results
res = struct();
res.instrument = idn;
res.timestamp  = datetime("now");
res.cfg        = cfg;

% Carrier as found by the FSWP
res.carrierHz        = scpiQueryNumber(fswp, "FETC:PNO1:MEAS:FREQ?");
res.carrierLevel_dBm = scpiQueryNumber(fswp, "FETC:PNO1:MEAS:LEV?");

% Spot noise at each decade and at the custom offsets
res.spotDecadeHz     = scpiQueryNumbers(fswp, "CALC1:SNO:DEC:X?");
res.spotDecade_dBcHz = scpiQueryNumbers(fswp, "CALC1:SNO:DEC:Y?");
res.spotUserHz       = cfg.spotOffsetsHz;
res.spotUser_dBcHz   = nan(size(cfg.spotOffsetsHz));
for k = 1:numel(cfg.spotOffsetsHz)
    res.spotUser_dBcHz(k) = scpiQueryNumber(fswp, sprintf("CALC1:SNO%d:Y?", k));
end

% Integrated results over the whole measurement range
res.ipn_dBc         = scpiQueryNumber(fswp, "FETC:PNO1:IPN?"); % integrated phase noise
res.residualPM_deg  = scpiQueryNumber(fswp, "FETC:PNO1:RPM?"); % residual PM
res.residualFM_Hz   = scpiQueryNumber(fswp, "FETC:PNO1:RFM?"); % residual FM
res.rmsJitter_s     = scpiQueryNumber(fswp, "FETC:PNO1:RMS?"); % RMS jitter
scpiCheck(fswp, "reading the results");

% Integrated results over a user-defined range (jitter band). Optional:
% older firmware may not offer user ranges, in which case this only warns.
jitterRange = [max(cfg.jitterRangeHz(1), cfg.offsetStartHz), ...
               min(cfg.jitterRangeHz(2), cfg.offsetStopHz)];
res.userRangeHz = jitterRange;
scpiWrite(fswp, sprintf("CALC1:EVAL:USER1:STAR %.12g", jitterRange(1)));
scpiWrite(fswp, sprintf("CALC1:EVAL:USER1:STOP %.12g", jitterRange(2)));
scpiWrite(fswp, "CALC1:EVAL:USER1:STAT ON");
if scpiWarn(fswp, "user evaluation range")
    res.userIpn_dBc     = scpiQueryNumber(fswp, "FETC:PNO1:USER1:IPN?");
    res.userRmsJitter_s = scpiQueryNumber(fswp, "FETC:PNO1:USER1:RMS?");
    scpiWarn(fswp, "user range results");
else
    res.userIpn_dBc     = NaN;
    res.userRmsJitter_s = NaN;
end

% Spurs: the FSWP returns offset/level pairs for every spur it detected
spurs = scpiQueryNumbers(fswp, "FETC:PNO1:SPUR?");
if mod(numel(spurs), 2) ~= 0
    warning("Spur list has an odd number of values; ignoring it.");
    spurs = [];
end
res.spurOffsetHz  = spurs(1:2:end);
res.spurLevel_dBc = spurs(2:2:end);
scpiWarn(fswp, "spur list");

% The trace: y values in dBc/Hz, x values (offsets in Hz) from a second query
res.trace_dBcHz = scpiQueryNumbers(fswp, "TRAC1:DATA? TRACE1");
scpiCheck(fswp, "reading the trace");
try
    res.offsetHz = scpiQueryNumbers(fswp, "TRAC1:DATA:X? TRACE1");
catch
    res.offsetHz = [];   % no answer: fall through to the interleaved format below
end
scpiWarn(fswp, "trace x-axis query");
if numel(res.trace_dBcHz) == 2 * numel(res.offsetHz) || isempty(res.offsetHz)
    % Some firmware versions return interleaved offset/level pairs instead
    res.offsetHz    = res.trace_dBcHz(1:2:end);
    res.trace_dBcHz = res.trace_dBcHz(2:2:end);
end
if numel(res.trace_dBcHz) ~= numel(res.offsetHz)
    error("Trace x and y data differ in length (%d vs %d).", ...
        numel(res.offsetHz), numel(res.trace_dBcHz));
end

% Print a summary
fprintf("\n--- Phase noise results ---\n");
fprintf("Carrier          %s at %.2f dBm\n", fmtHz(res.carrierHz), res.carrierLevel_dBm);
fprintf("Trace points     %d\n", numel(res.offsetHz));
fprintf("Spot noise per decade:\n");
for k = 1:numel(res.spotDecadeHz)
    fprintf("  %12s   %8.2f dBc/Hz\n", fmtHz(res.spotDecadeHz(k)), res.spotDecade_dBcHz(k));
end
fprintf("Spot noise at custom offsets:\n");
for k = 1:numel(res.spotUserHz)
    fprintf("  %12s   %8.2f dBc/Hz\n", fmtHz(res.spotUserHz(k)), res.spotUser_dBcHz(k));
end
fprintf("Integrated over %s to %s:\n", fmtHz(cfg.offsetStartHz), fmtHz(cfg.offsetStopHz));
fprintf("  Int. phase noise %8.2f dBc\n", res.ipn_dBc);
fprintf("  Residual PM      %8.4g deg\n", res.residualPM_deg);
fprintf("  Residual FM      %8.4g Hz\n", res.residualFM_Hz);
fprintf("  RMS jitter       %8.4g s\n", res.rmsJitter_s);
if ~isnan(res.userIpn_dBc)
    fprintf("Integrated over %s to %s:\n", fmtHz(jitterRange(1)), fmtHz(jitterRange(2)));
    fprintf("  Int. phase noise %8.2f dBc\n", res.userIpn_dBc);
    fprintf("  RMS jitter       %8.4g s\n", res.userRmsJitter_s);
end
fprintf("Spurs detected   %d\n", numel(res.spurOffsetHz));
for k = 1:numel(res.spurOffsetHz)
    fprintf("  %12s   %8.2f dBc\n", fmtHz(res.spurOffsetHz(k)), res.spurLevel_dBc(k));
end

%% Plot the phase noise trace
figure("Name", "FSWP phase noise", "Color", "w");
semilogx(res.offsetHz, res.trace_dBcHz, "LineWidth", 1.2, "DisplayName", "Trace 1");
hold on; grid on;
plot(res.spotDecadeHz, res.spotDecade_dBcHz, "o", "MarkerSize", 7, ...
    "LineWidth", 1.2, "DisplayName", "Spot noise (decades)");
for k = 1:numel(res.spotDecadeHz)
    text(res.spotDecadeHz(k), res.spotDecade_dBcHz(k), ...
        sprintf("  %.1f", res.spotDecade_dBcHz(k)), "VerticalAlignment", "bottom");
end
if ~isempty(res.spotUserHz)
    plot(res.spotUserHz, res.spotUser_dBcHz, "s", "MarkerSize", 7, ...
        "LineWidth", 1.2, "DisplayName", "Spot noise (custom)");
end
if ~isempty(res.spurOffsetHz)
    plot(res.spurOffsetHz, res.spurLevel_dBc, "^", "MarkerSize", 6, ...
        "LineWidth", 1.2, "DisplayName", "Spurs (dBc)");
end
xlim([cfg.offsetStartHz cfg.offsetStopHz]);
xlabel("Offset frequency (Hz)");
ylabel("Phase noise (dBc/Hz)");
title(sprintf("Phase noise - carrier %s at %.2f dBm", fmtHz(res.carrierHz), res.carrierLevel_dBm));
legend("Location", "northeast");
hold off;

%% Save the results
if ~isfolder(cfg.outputFolder)
    mkdir(cfg.outputFolder);
end
stamp = string(datetime("now"), "yyyyMMdd_HHmmss");
matFile = fullfile(cfg.outputFolder, "fswp_phase_noise_" + stamp + ".mat");
csvFile = fullfile(cfg.outputFolder, "fswp_phase_noise_trace_" + stamp + ".csv");
save(matFile, "res");
writetable(table(res.offsetHz(:), res.trace_dBcHz(:), ...
    "VariableNames", {'OffsetHz', 'PhaseNoise_dBcHz'}), csvFile);
fprintf("\nSaved %s\n      %s\n", matFile, csvFile);

%% Optional: spectrum measurement (R&S FSWP-B1)
installed = any(strcmpi(strtrim(split(opts, ",")), "B1"));
switch lower(char(string(cfg.spectrumDemo)))
    case 'on'
        runSpectrum = true;
    case 'off'
        runSpectrum = false;
    otherwise
        runSpectrum = installed;
end

if ~runSpectrum
    fprintf("\nSpectrum demo skipped (FSWP-B1 installed: %s).\n", onOff(installed));
else
    % Remember the phase noise channel so we can return to it afterwards.
    % INST:LIST? answers with type,'name' pairs, e.g. PNOISE,'Phase Noise'
    channels = scpiQuery(fswp, "INST:LIST?");
    parts = split(channels, "'");   % names sit between the quotes: parts(2), parts(4), ...
    if numel(parts) >= 2
        pnChannel = parts(2);
    else
        pnChannel = "";
    end

    % Open a spectrum channel next to it (or reuse one from an earlier run)
    if contains(channels, "'Spectrum'")
        scpiWrite(fswp, "INST:SEL 'Spectrum'");
    else
        scpiWrite(fswp, "INST:CRE:NEW SANalyzer,'Spectrum'");
    end
    scpiCheck(fswp, "opening the spectrum channel");

    scpiWrite(fswp, "INIT:CONT OFF");
    scpiWrite(fswp, sprintf("SENS:FREQ:CENT %.12g", res.carrierHz));
    scpiWrite(fswp, sprintf("SENS:FREQ:SPAN %.12g", cfg.spanHz));
    scpiWrite(fswp, sprintf("SENS:BWID:RES %.12g", cfg.rbwHz));
    scpiWrite(fswp, "SENS:BWID:VID:AUTO ON");            % VBW coupled to RBW
    scpiWrite(fswp, sprintf("DISP:WIND1:TRAC1:Y:SCAL:RLEV %g", cfg.refLevel_dBm));
    scpiWrite(fswp, "INP:ATT:AUTO ON");
    scpiWrite(fswp, "DISP:WIND1:TRAC1:MODE WRIT");        % clear/write trace
    scpiWrite(fswp, "SENS:SWE:TIME:AUTO ON");

    % Channel power over cfg.chanBwHz around the center
    scpiWrite(fswp, "CALC1:MARK1:FUNC:POW:SEL CPOW");
    scpiWrite(fswp, sprintf("SENS:POW:ACH:BWID:CHAN1 %.12g", cfg.chanBwHz));
    scpiCheck(fswp, "spectrum configuration");

    scpiRunSingle(fswp, 60, "spectrum sweep");
    scpiCheck(fswp, "spectrum sweep");

    spec = struct();
    spec.timestamp = datetime("now");
    scpiWrite(fswp, "CALC1:MARK1:STAT ON");
    scpiWrite(fswp, "CALC1:MARK1:MAX");                   % peak search with marker 1
    spec.peakHz       = scpiQueryNumber(fswp, "CALC1:MARK1:X?");
    spec.peak_dBm     = scpiQueryNumber(fswp, "CALC1:MARK1:Y?");
    spec.chanPow_dBm  = scpiQueryNumber(fswp, "CALC1:MARK1:FUNC:POW:RES? CPOW");
    spec.chanBwHz     = cfg.chanBwHz;
    spec.trace_dBm    = scpiQueryNumbers(fswp, "TRAC1:DATA? TRACE1");
    spec.frequencyHz  = scpiQueryNumbers(fswp, "TRAC1:DATA:X? TRACE1");
    scpiCheck(fswp, "reading the spectrum results");

    fprintf("\n--- Spectrum results ---\n");
    fprintf("Peak             %s at %.2f dBm\n", fmtHz(spec.peakHz), spec.peak_dBm);
    fprintf("Channel power    %.2f dBm in %s\n", spec.chanPow_dBm, fmtHz(spec.chanBwHz));
    fprintf("Trace points     %d\n", numel(spec.frequencyHz));

    figure("Name", "FSWP spectrum", "Color", "w");
    plot(spec.frequencyHz / 1e6, spec.trace_dBm, "LineWidth", 1.0, "DisplayName", "Trace 1");
    hold on; grid on;
    plot(spec.peakHz / 1e6, spec.peak_dBm, "v", "MarkerSize", 8, "LineWidth", 1.2, ...
        "DisplayName", sprintf("Peak %.2f dBm", spec.peak_dBm));
    xlabel("Frequency (MHz)");
    ylabel("Level (dBm)");
    title(sprintf("Spectrum - span %s, RBW %s, channel power %.2f dBm", ...
        fmtHz(cfg.spanHz), fmtHz(cfg.rbwHz), spec.chanPow_dBm));
    legend("Location", "northeast");
    hold off;

    specFile = fullfile(cfg.outputFolder, "fswp_spectrum_" + stamp + ".mat");
    save(specFile, "spec");
    fprintf("Saved %s\n", specFile);

    % Back to the phase noise channel
    if strlength(pnChannel) > 0
        scpiWrite(fswp, "INST:SEL '" + pnChannel + "'");
    else
        scpiWrite(fswp, "INST:SEL PNOise");
    end
    scpiWarn(fswp, "returning to the phase noise channel");
end

%% Disconnect
scpiWrite(fswp, "INIT:CONT ON");   % leave the instrument measuring continuously again
clear fswp                          % closes the socket / VISA session
fprintf("\nDone.\n");

%% ------------------------------------------------------------------------
%  Helper functions - generic SCPI plumbing for tcpclient and visadev
%  ------------------------------------------------------------------------

function dev = scpiConnect(resource, timeoutS)
% Open a connection. VISA resource strings go through visadev (Instrument
% Control Toolbox); anything else is treated as a hostname or IP address and
% opened as a raw SCPI socket on port 5025 with tcpclient (base MATLAB).
    resource = string(resource);
    if contains(resource, "::")
        dev = visadev(resource);
    else
        dev = tcpclient(char(resource), 5025, "Timeout", timeoutS, "ConnectTimeout", 10);
    end
    dev.Timeout = timeoutS;
    configureTerminator(dev, "LF");
    flush(dev);
end

function scpiWrite(dev, cmd)
% Send a command that expects no answer.
    writeline(dev, cmd);
end

function resp = scpiQuery(dev, cmd)
% Send a query and return the answer as a trimmed string.
    resp = strtrim(string(writeread(dev, cmd)));
end

function value = scpiQueryNumber(dev, cmd)
% Query a single number.
    values = scpiQueryNumbers(dev, cmd);
    if isempty(values)
        value = NaN;
    else
        value = values(1);
    end
end

function values = scpiQueryNumbers(dev, cmd)
% Query a list of numbers. Handles both answer formats the FSWP uses:
%   - ASCII: comma separated values terminated by LF (FORM ASC)
%   - binary: IEEE 488.2 definite length block #<n><length><float32 data>LF
%     (FORM REAL,32), which is much faster for long traces
% R&S instruments encode "no value" as 9.91e37; that becomes NaN here.
    writeline(dev, cmd);
    first = read(dev, 1, "uint8");
    if isempty(first)
        error("No answer to '%s' within %g s.", cmd, dev.Timeout);
    end
    if first == uint8(newline)
        values = [];                       % empty answer, e.g. no spurs found
        return
    end
    if first == uint8('#')
        nDigits = str2double(char(read(dev, 1, "uint8")));
        if isnan(nDigits) || nDigits == 0
            error("Unsupported binary block header in the answer to '%s'.", cmd);
        end
        nBytes = str2double(char(read(dev, nDigits, "uint8")));
        raw = uint8([]);
        if nBytes > 0
            raw = read(dev, nBytes, "uint8");
        end
        if numel(raw) ~= nBytes
            error("Binary block from '%s' is short: %d of %d bytes.", cmd, numel(raw), nBytes);
        end
        values = double(typecast(uint8(raw(:)), "single"))';
        discardTerminator(dev);
    else
        txt = [char(first) char(readline(dev))];
        values = str2double(split(string(strtrim(txt)), ","))';
    end
    values(abs(values) >= 9e37) = NaN;
end

function discardTerminator(dev)
% A binary block is followed by a line feed. Wait briefly for it and drop
% it, so the next readline does not see an empty line.
    tWait = tic;
    while dev.NumBytesAvailable == 0 && toc(tWait) < 1
        pause(0.01);
    end
    if dev.NumBytesAvailable > 0
        read(dev, dev.NumBytesAvailable, "uint8");
    end
end

function scpiRunSingle(dev, timeoutS, label)
% Start a single measurement and wait for it to finish without blocking on
% a long read timeout: *OPC sets bit 0 of the event status register when
% all pending operations are complete, and *ESR? is polled until it does.
% The measurement is aborted if it runs past timeoutS.
    writeline(dev, "*CLS");
    writeline(dev, "INIT:IMM;*OPC");
    tRun = tic;
    lastReport = 0;
    while true
        esr = str2double(writeread(dev, "*ESR?"));
        if bitand(uint16(esr), uint16(1)) ~= 0
            return
        end
        if toc(tRun) > timeoutS
            writeline(dev, "ABOR");
            error("The %s did not finish within %g s and was aborted.", label, timeoutS);
        end
        if toc(tRun) - lastReport >= 10
            lastReport = toc(tRun);
            fprintf("  ... %s running, %.0f s elapsed\n", label, lastReport);
        end
        pause(0.5);
    end
end

function errors = scpiErrors(dev)
% Drain the instrument error queue. Returns a string array, empty if the
% queue held nothing but 0,"No error".
    errors = strings(0, 1);
    for k = 1:50
        entry = strtrim(string(writeread(dev, "SYST:ERR?")));
        if startsWith(entry, "0,")
            break
        end
        errors(end + 1, 1) = entry; %#ok<AGROW>
    end
end

function scpiCheck(dev, context)
% Stop the script if the instrument reported an error during `context`.
    errors = scpiErrors(dev);
    if ~isempty(errors)
        error("The FSWP reported errors during %s:\n  %s", context, join(errors, newline + "  "));
    end
end

function ok = scpiWarn(dev, context)
% Like scpiCheck, but only warns. Returns true when there was no error.
    errors = scpiErrors(dev);
    ok = isempty(errors);
    if ~ok
        warning("FSWP errors during %s (skipping this step):\n  %s", ...
            context, join(errors, newline + "  "));
    end
end

function s = onOff(flag)
    if flag
        s = "ON";
    else
        s = "OFF";
    end
end

function s = fmtHz(f)
% Frequency with an engineering unit, for printing.
    a = abs(f);
    if a >= 1e9
        s = sprintf("%.6g GHz", f / 1e9);
    elseif a >= 1e6
        s = sprintf("%.6g MHz", f / 1e6);
    elseif a >= 1e3
        s = sprintf("%.6g kHz", f / 1e3);
    else
        s = sprintf("%.6g Hz", f);
    end
end
