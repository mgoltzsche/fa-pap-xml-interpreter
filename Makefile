IMAGE=lohnsteuer-node-build
$(eval DOCKER ?= $(if $(shell podman -v),podman,docker))

build: build-image clean
	CTR=`$(DOCKER) create $(IMAGE)` && $(DOCKER) cp $$CTR:/source/dist dist; \
	STATUS=$$?; \
	$(DOCKER) rm $$CTR; \
	exit $$STATUS

build-image:
	$(DOCKER) build --force-rm -t $(IMAGE) .

clean:
	rm -rf dist

publish: build
	rm -rf docs
	cp -r dist docs
