#!/bin/sh
# usage: cmd2.sh PORT '{"op":...}'
curl -sS --max-time 180 -X POST -H 'content-type: application/json' --data "$2" "http://127.0.0.1:$1/" --noproxy '*'
