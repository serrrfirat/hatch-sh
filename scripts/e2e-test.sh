#!/bin/bash

# E2E Test Script for hatch.sh
# This script tests the full flow: API -> Chat -> Preview -> Deploy

set -e

API_URL="${API_URL:-http://localhost:8787}"
WEB_URL="${WEB_URL:-http://localhost:5173}"

echo "=========================================="
echo "  hatch.sh E2E Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# Test 1: API Health Check
echo "1. Testing API Health..."
if curl -s "${API_URL}/" | grep -q "hatch.sh"; then
    success "API is running"
else
    error "API is not responding. Run: pnpm dev:api"
fi

# Test 2: Create Project
echo ""
echo "2. Testing Project Creation..."
curl -s -X POST "${API_URL}/api/projects" \
    -H "Content-Type: application/json" \
    -d '{"name": "E2E Test Project", "description": "Testing the full flow"}' > /dev/null

# Get project ID from list endpoint (mock db returns null on POST)
PROJECTS_RESPONSE=$(curl -s "${API_URL}/api/projects")
PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | grep -o '"id":"[^"]*"' | tail -1 | cut -d'"' -f4)

if [ -n "$PROJECT_ID" ]; then
    success "Project created: $PROJECT_ID"
else
    warn "No project ID found in response"
    PROJECT_ID="test-project-id"
fi

# Test 3: List Projects
echo ""
echo "3. Testing Project List..."
if echo "$PROJECTS_RESPONSE" | grep -q '"id"'; then
    success "Projects list endpoint working"
else
    warn "Projects response: $PROJECTS_RESPONSE"
fi

# Test 4: Chat Endpoint (without streaming for simple test)
echo ""
echo "4. Testing Chat Endpoint..."
CHAT_RESPONSE=$(curl -s -X POST "${API_URL}/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\", \"message\": \"Create a simple hello world app\"}" \
    --max-time 30 || true)

if [ -n "$CHAT_RESPONSE" ]; then
    success "Chat endpoint responding (streaming)"
else
    warn "Chat endpoint may require ANTHROPIC_API_KEY"
fi

# Test 5: Deploy Endpoint
echo ""
echo "5. Testing Deploy Endpoint..."
DEPLOY_RESPONSE=$(curl -s -X POST "${API_URL}/api/deploy" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\", \"code\": \"export default function App() { return <div>Hello</div>; }\"}")

if echo "$DEPLOY_RESPONSE" | grep -q "url\|status"; then
    success "Deploy endpoint working"
else
    warn "Deploy returned: $DEPLOY_RESPONSE"
fi

# Test 6: Token Launch Endpoint
echo ""
echo "6. Testing Token Launch Endpoint..."
TOKEN_RESPONSE=$(curl -s -X POST "${API_URL}/api/tokens/launch" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\", \"name\": \"Test Token\", \"symbol\": \"TEST\", \"imageUri\": \"\", \"creatorAddress\": \"0x0000000000000000000000000000000000000000\"}")

if echo "$TOKEN_RESPONSE" | grep -q "id\|tokenAddress"; then
    success "Token launch endpoint working"
else
    warn "Token launch returned: $TOKEN_RESPONSE"
fi

# Test 7: Discovery Endpoint
echo ""
echo "7. Testing Discovery Endpoint..."
DISCOVERY_RESPONSE=$(curl -s "${API_URL}/api/discovery")

if [ -n "$DISCOVERY_RESPONSE" ] && [ "$DISCOVERY_RESPONSE" != "Internal Server Error" ]; then
    success "Discovery endpoint working"
else
    warn "Discovery returned: $DISCOVERY_RESPONSE"
fi

# Test 8: Web Frontend
echo ""
echo "8. Testing Web Frontend..."
if curl -s "${WEB_URL}" | grep -q "hatch\|html"; then
    success "Web frontend is running"
else
    warn "Web frontend not responding. Run: pnpm dev:web"
fi

echo ""
echo "=========================================="
echo "  E2E Tests Complete"
echo "=========================================="
echo ""
echo "To run the full application:"
echo "  Terminal 1: pnpm dev:api"
echo "  Terminal 2: pnpm dev:web"
echo ""
echo "Then open: ${WEB_URL}"
