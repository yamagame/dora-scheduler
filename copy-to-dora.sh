#!/bin/bash
cd `dirname $0`
rm ../dora-engine/public/counter/index.html
rm ../dora-engine/public/static/js/main-counter.*.js
rm ../dora-engine/public/static/css/main-counter.*.css
cp ./build/index.html ../dora-engine/public/counter/
cp ./build/static/js/main-*.js ../dora-engine/public/static/js/
cp ./build/static/css/main-*.css ../dora-engine/public/static/css/
