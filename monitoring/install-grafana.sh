#!/bin/bash

# Ëtrid PrimeArc Core Chain Validator Monitoring - Grafana Installation Script
# This script installs and configures Grafana for visualizing PrimeArc Core Chain metrics

set -e

echo "═══════════════════════════════════════════════════════════"
echo "Ëtrid PrimeArc Core Chain - Grafana Installation"
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

# Check if Grafana is already installed
if command -v grafana-server &> /dev/null; then
    echo "✅ Grafana is already installed"
    echo ""
    read -p "Do you want to reconfigure it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping installation..."
        exit 0
    fi
else
    echo "📦 Installing Grafana..."
    echo ""

    if [[ "$OS" == "macos" ]]; then
        # Install using Homebrew
        if ! command -v brew &> /dev/null; then
            echo "❌ Homebrew not found. Please install Homebrew first:"
            echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi

        echo "Installing Grafana via Homebrew..."
        brew install grafana

    elif [[ "$OS" == "linux" ]]; then
        # Install on Linux (Debian/Ubuntu)
        echo "Adding Grafana repository..."

        sudo apt-get install -y apt-transport-https software-properties-common wget

        wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
        echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list

        echo "Installing Grafana..."
        sudo apt-get update
        sudo apt-get install -y grafana

        echo "Grafana installed"
    fi
fi

echo ""
echo "📝 Configuring Grafana..."
echo ""

# Configure Grafana
if [[ "$OS" == "macos" ]]; then
    GRAFANA_CONFIG="/usr/local/etc/grafana/grafana.ini"
    GRAFANA_PROVISIONING_DIR="/usr/local/etc/grafana/provisioning"
elif [[ "$OS" == "linux" ]]; then
    GRAFANA_CONFIG="/etc/grafana/grafana.ini"
    GRAFANA_PROVISIONING_DIR="/etc/grafana/provisioning"
fi

# Create provisioning directories
sudo mkdir -p "$GRAFANA_PROVISIONING_DIR/datasources"
sudo mkdir -p "$GRAFANA_PROVISIONING_DIR/dashboards"

# Create Prometheus datasource
echo "Creating Prometheus datasource configuration..."
sudo tee "$GRAFANA_PROVISIONING_DIR/datasources/prometheus.yml" > /dev/null <<EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    version: 1
    editable: true
    jsonData:
      timeInterval: "15s"
      queryTimeout: "60s"
      httpMethod: "POST"
EOF

echo "✅ Created Prometheus datasource configuration"

# Create dashboard provisioning config
echo "Creating dashboard provisioning configuration..."
sudo tee "$GRAFANA_PROVISIONING_DIR/dashboards/etrid-dashboards.yml" > /dev/null <<EOF
apiVersion: 1

providers:
  - name: 'Ëtrid PrimeArc Core Chain'
    orgId: 1
    folder: 'Ëtrid'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: $GRAFANA_PROVISIONING_DIR/dashboards
      foldersFromFilesStructure: true
EOF

echo "✅ Created dashboard provisioning configuration"

# Copy dashboard if it exists
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DASHBOARD_FILE="$SCRIPT_DIR/grafana-dashboard-primearc_core_chain.json"

if [ -f "$DASHBOARD_FILE" ]; then
    sudo cp "$DASHBOARD_FILE" "$GRAFANA_PROVISIONING_DIR/dashboards/"
    echo "✅ Copied PrimeArc Core Chain dashboard to $GRAFANA_PROVISIONING_DIR/dashboards/"
else
    echo "⚠️  Warning: grafana-dashboard-primearc_core_chain.json not found in $SCRIPT_DIR"
fi

# Update Grafana configuration for better defaults
if [[ "$OS" == "linux" ]]; then
    sudo sed -i 's/;admin_password = admin/admin_password = etrid2025/' "$GRAFANA_CONFIG" || true
    sudo sed -i 's/;domain = localhost/domain = localhost/' "$GRAFANA_CONFIG" || true
fi

echo ""
echo "✅ Configuration complete!"
echo ""

# Start Grafana
if [[ "$OS" == "linux" ]]; then
    echo "📝 Setting up systemd service..."
    sudo systemctl daemon-reload
    sudo systemctl enable grafana-server

    echo ""
    echo "🚀 Starting Grafana..."
    sudo systemctl start grafana-server

    # Check status
    sleep 3
    if sudo systemctl is-active --quiet grafana-server; then
        echo "✅ Grafana is running!"
    else
        echo "❌ Failed to start Grafana. Check logs with: sudo journalctl -u grafana-server -f"
        exit 1
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Grafana Installation Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Access Grafana:"
echo "   URL:      http://localhost:3000"
echo "   Username: admin"
echo "   Password: etrid2025"
echo ""
echo "   (Change password after first login!)"
echo ""

if [[ "$OS" == "macos" ]]; then
    echo "🚀 To start Grafana:"
    echo "   brew services start grafana"
    echo ""
    echo "   Or run manually:"
    echo "   grafana-server --config=$GRAFANA_CONFIG --homepath=/usr/local/share/grafana"
    echo ""
    echo "🔧 Manage Grafana:"
    echo "   Start:   brew services start grafana"
    echo "   Stop:    brew services stop grafana"
    echo "   Restart: brew services restart grafana"
elif [[ "$OS" == "linux" ]]; then
    echo "🔧 Manage Grafana:"
    echo "   Start:   sudo systemctl start grafana-server"
    echo "   Stop:    sudo systemctl stop grafana-server"
    echo "   Restart: sudo systemctl restart grafana-server"
    echo "   Status:  sudo systemctl status grafana-server"
    echo "   Logs:    sudo journalctl -u grafana-server -f"
fi

echo ""
echo "📋 Configuration files:"
echo "   Config:      $GRAFANA_CONFIG"
echo "   Datasources: $GRAFANA_PROVISIONING_DIR/datasources/"
echo "   Dashboards:  $GRAFANA_PROVISIONING_DIR/dashboards/"
echo ""
echo "📈 Next steps:"
echo "   1. Open http://localhost:3000"
echo "   2. Login with admin/etrid2025"
echo "   3. Change your password"
echo "   4. Navigate to Dashboards > Ëtrid PrimeArc Core Chain Validators"
echo "   5. Verify metrics are being collected"
echo ""
echo "💡 Tips:"
echo "   - The Prometheus datasource is pre-configured"
echo "   - The PrimeArc Core Chain dashboard is automatically imported"
echo "   - Refresh interval is set to 10 seconds"
echo "   - Add more validators by editing prometheus-primearc_core_chain.yml"
echo ""
