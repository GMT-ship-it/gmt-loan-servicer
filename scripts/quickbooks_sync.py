#!/usr/bin/env python3
import json
import os
from datetime import datetime

TOKEN_PATH = "/root/.openclaw/credentials/quickbooks_tokens.json"
DB_PATH = "/root/.openclaw/workspace/gmt-loan-servicer/loans.json"

def load_tokens():
    if not os.path.exists(TOKEN_PATH):
        print("Error: No QuickBooks tokens found. Please complete the OAuth flow.")
        return None
    with open(TOKEN_PATH) as f:
        return json.load(f)

def perform_sync(tokens):
    data = {}
    if os.path.exists(DB_PATH):
        with open(DB_PATH) as f:
            data = json.load(f)
    result = {
        "synced_at": datetime.utcnow().isoformat() + 'Z',
        "records": len(data if isinstance(data, list) else []),
        "notes": "Mock sync completed successfully."
    }
    return result

def main():
    print("Starting QuickBooks Sync...")
    tokens = load_tokens()
    if not tokens:
        return
    res = perform_sync(tokens)
    log_path = "/root/.openclaw/workspace/gmt-loan-servicer/sync.log"
    with open(log_path, 'a') as f:
        f.write(json.dumps(res) + "\n")
    print(f"Sync complete: {res}")

if __name__ == '__main__':
    main()
