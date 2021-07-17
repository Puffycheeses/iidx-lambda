#!/bin/sh

echo 'Begin: Linting'
yarn prettier -w src/**/*
yarn eslint --fix src/**/*
echo 'Complete: Linting'
