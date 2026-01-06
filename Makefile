.PHONY: build install clean run-demo run-calendar run-map deps

BINARY=claude-canvas
BUILD_DIR=.
INSTALL_DIR=$(HOME)/.local/bin

build: deps
	go build -o $(BUILD_DIR)/$(BINARY) ./cmd/claude-canvas

deps:
	go mod tidy

install: build
	mkdir -p $(INSTALL_DIR)
	cp $(BUILD_DIR)/$(BINARY) $(INSTALL_DIR)/$(BINARY)
	@echo "Installed to $(INSTALL_DIR)/$(BINARY)"

clean:
	rm -f $(BUILD_DIR)/$(BINARY)

run-demo: build
	./$(BINARY) show demo

run-calendar: build
	./$(BINARY) show calendar

run-map: build
	./$(BINARY) show map

spawn-demo: build
	./$(BINARY) spawn demo

spawn-calendar: build
	./$(BINARY) spawn calendar

spawn-map: build
	./$(BINARY) spawn map

env: build
	./$(BINARY) env
