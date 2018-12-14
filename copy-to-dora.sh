#!/bin/bash
cd `dirname $0`
rm ../dora-engine/public/scheduler/index.html
rm ../dora-engine/public/static/js/main-scheduler.*.js
rm ../dora-engine/public/static/css/main-scheduler.*.css
cp ./build/index.html ../dora-engine/public/scheduler/
cp ./build/static/js/main-*.js ../dora-engine/public/static/js/
cp ./build/static/css/main-*.css ../dora-engine/public/static/css/
