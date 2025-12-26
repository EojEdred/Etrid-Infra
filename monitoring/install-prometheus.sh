#!/bin/bash

# Ëtrid PrimeArc Core Chain Validator Monitoring - Prometheus Installation Script
# This script installs and configures Prometheus for monitoring PrimeArc Core Chain validators

set -e

echo "═══════════════════════════════════════════════════════════"
echo "Ëtrid PrimeArc Core Chain - Prometheus Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

echo "📍 Detected OS: $OS"
echo ""

# Check if Prometheus is already installed
if command -v prometheus &> /dev/null; then
    CURRENT_VERSION=$(prometheus --version 2>&1 | head -n 1 | awk '{print $3}')
    echo "✅ Prometheus is already installed: $CURRENT_VERSION"
    echo ""
    read -p "Do you want to reconfigure it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping installation..."
        exit 0
    fi
else
    echo "📦 Installing Prometheus..."
    echo ""

    if [[ "$OS" == "macos" ]]; then
        # Install using Homebrew
        if ! command -v brew &> /dev/null; then
            echo "❌ Homebrew not found. Please install Homebrew first:"
            echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi

        echo "Installing Prometheus via Homebrew..."
        brew install prometheus

    elif [[ "$OS" == "linux" ]]; then
        # Install on Linux
        PROMETHEUS_VERSION="2.45.0"

        echo "Downloading Prometheus v$PROMETHEUS_VERSION..."
        cd /tmp
        wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz

        echo "Extracting..."
        tar xvfz prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz

        echo "Installing..."
        sudo mv prometheus-${PROMETHEUS_VERSION}.linux-amd64 /opt/prometheus
        sudo ln -sf /opt/prometheus/prometheus /usr/local/bin/prometheus
        sudo ln -sf /opt/prometheus/promtool /usr/local/bin/promtool

        # Create prometheus user
        sudo useradd --no-create-home --shell /bin/false prometheus || true

        # Create directories
        sudo mkdir -p /etc/prometheus
        sudo mkdir -p /var/lib/prometheus
        sudo chown -R prometheus:prometheus /etc/prometheus
        sudo chown -R prometheus:prometheus /var/lib/prometheus

        echo "Prometheus installed to /opt/prometheus"
    fi
fi

# Setup configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROMETHEUS_CONFIG="$SCRIPT_DIR/prometheus-primearc_core_chain.yml"
ALERTING_RULES="$SCRIPT_DIR/alerting-rules-primearc_core_chain.yml"

if [[ "$OS" == "macos" ]]; then
    PROMETHEUS_CONFIG_DIR="$(brew --prefix)/etc"
    PROMETHEUS_DATA_DIR="$(brew --prefix)/var/prometheus"
elif [[ "$OS" == "linux" ]]; then
    PROMETHEUS_CONFIG_DIR="/etc/prometheus"
    PROMETHEUS_DATA_DIR="/var/lib/prometheus"
fi

echo ""
echo "📝 Configuring Prometheus..."
echo ""

# Copy configuration files
if [ -f "$PROMETHEUS_CONFIG" ]; then
    sudo cp "$PROMETHEUS_CONFIG" "$PROMETHEUS_CONFIG_DIR/prometheus.yml"
    echo "✅ Copied prometheus-primearc_core_chain.yml to $PROMETHEUS_CONFIG_DIR/prometheus.yml"
else
    echo "⚠️  Warning: prometheus-primearc_core_chain.yml not found in $SCRIPT_DIR"
fi

if [ -f "$ALERTING_RULES" ]; then
    sudo cp "$ALERTING_RULES" "$PROMETHEUS_CONFIG_DIR/alerting-rules-primearc_core_chain.yml"
    echo "✅ Copied alerting rules to $PROMETHEUS_CONFIG_DIR/"
else
    echo "⚠️  Warning: alerting-rules-primearc_core_chain.yml not found in $SCRIPT_DIR"
fi

# Set permissions
if [[ "$OS" == "linux" ]]; then
    sudo chown -R prometheus:prometheus "$PROMETHEUS_CONFIG_DIR"
fi

echo ""
echo "✅ Configuration complete!"
echo ""

# Create systemd service for Linux
if [[ "$OS" == "linux" ]]; then
    echo "📝 Creating systemd service..."

    sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus - Monitoring for Ëtrid PrimeArc Core Chain
Documentation=https://prometheus.io/docs/introduction/overview/
After=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/prometheus \\
  --config.file=/etc/prometheus/prometheus.yml \\
  --storage.tsdb.path=/var/lib/prometheus/ \\
  --storage.tsdb.retention.time=30d \\
  --storage.tsdb.retention.size=100GB \\
  --web.console.templates=/opt/prometheus/consoles \\
  --web.console.libraries=/opt/prometheus/console_libraries \\
  --web.listen-address=0.0.0.0:9090

Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF

    echo "✅ Created systemd service at /etc/systemd/system/prometheus.service"

    sudo systemctl daemon-reload
    sudo systemctl enable prometheus

    echo ""
    echo "🚀 Starting Prometheus..."
    sudo systemctl start prometheus

    # Check status
    sleep 2
    if sudo systemctl is-active --quiet prometheus; then
        echo "✅ Prometheus is running!"
    else
        echo "❌ Failed to start Prometheus. Check logs with: sudo journalctl -u prometheus -f"
        exit 1
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Prometheus Installation Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Access Prometheus:"
echo "   URL: http://localhost:9090"
echo ""

if [[ "$OS" == "macos" ]]; then
    echo "🚀 To start Prometheus:"
    echo "   brew services start prometheus"
    echo ""
    echo "   Or run manually:"
    echo "   prometheus --config.file=$PROMETHEUS_CONFIG_DIR/prometheus.yml"
    echo ""
    echo "📋 Configuration files:"
    echo "   Config: $PROMETHEUS_CONFIG_DIR/prometheus.yml"
    echo "   Alerts: $PROMETHEUS_CONFIG_DIR/alerting-rules-primearc_core_chain.yml"
    echo "   Data:   $PROMETHEUS_DATA_DIR"
elif [[ "$OS" == "linux" ]]; then
    echo "🔧 Manage Prometheus:"
    echo "   Start:   sudo systemctl start prometheus"
    echo "   Stop:    sudo systemctl stop prometheus"
    echo "   Restart: sudo systemctl restart prometheus"
    echo "   Status:  sudo systemctl status prometheus"
    echo "   Logs:    sudo journalctl -u prometheus -f"
    echo ""
    echo "📋 Configuration files:"
    echo "   Config: /etc/prometheus/prometheus.yml"
    echo "   Alerts: /etc/prometheus/alerting-rules-primearc_core_chain.yml"
    echo "   Data:   /var/lib/prometheus"
fi

echo ""
echo "🔍 Verify targets are being scraped:"
echo "   http://localhost:9090/targets"
echo ""
echo "📈 Next steps:"
echo "   1. Install Grafana: ./install-grafana.sh"
echo "   2. Import the dashboard: grafana-dashboard-primearc_core_chain.json"
echo "   3. Configure alerting (optional)"
echo ""
