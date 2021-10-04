FROM node:16.10-alpine3.14

WORKDIR /source

# Install C++ tool chain for node-sass build
RUN apk add --update --no-cache make python3 g++

# Build node-sass
RUN npm install node-sass@6.0.1

# Fetch other dependencies (cached)
COPY package.json /source/
RUN npm install

# Build node app
COPY src /source/src
COPY webpack.config.js /source/
RUN npm run build

# JSHint
RUN npm run jshint

# Test node app
COPY test /source/test
RUN npm run test
