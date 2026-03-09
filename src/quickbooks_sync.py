import json
import os
import requests
import datetime
import sys
import copy

CRED_PATH = '/root/.openclaw/credentials/quickbooks_tokens.json'
ENV_PATH = '/root/.openclaw/credentials/quickbooks.env'

def load_env():
    envs = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    k, v = line.strip().split('=', 1)
                    envs[k] = v
    return envs

def load_tokens():
    try:
        if os.path.exists(CRED_PATH):
            with open(CRED_PATH) as f:
                return json.load(f)
    except:
        pass
    return None

def save_tokens(toks):
    with open(CRED_PATH, 'w') as f:
        json.dump(toks, f, indent=2)

def get_base_url(env):
    if env == 'production':
        return 'https://quickbooks.api.intuit.com'
    return 'https://sandbox-quickbooks.api.intuit.com'

def refresh_access_token(envs, toks):
    import base64
    client_id = envs.get('QB_CLIENT_ID')
    client_secret = envs.get('QB_CLIENT_SECRET')
    refresh_token = toks.get('refresh_token')

    auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    
    url = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': f'Basic {auth_header}'
    }
    data = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token
    }

    resp = requests.post(url, headers=headers, data=data)
    if resp.status_code == 200:
        new_toks = resp.json()
        toks.update(new_toks)
        save_tokens(toks)
        return True
    else:
        print(f"Failed to refresh token: {resp.text}")
        return False

def make_qb_request(method, endpoint, payload=None, toks=None, envs=None):
    realm_id = toks.get('realmId')
    base_url = get_base_url(envs.get('QB_ENVIRONMENT', 'sandbox'))
    url = f"{base_url}/v3/company/{realm_id}/{endpoint}?minorversion=73"
    
    headers = {
        'Authorization': f"Bearer {toks.get('access_token')}",
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

    if method.upper() == 'POST':
        resp = requests.post(url, headers=headers, json=payload)
    else:
        resp = requests.get(url, headers=headers)
    
    if resp.status_code == 401:
        if refresh_access_token(envs, toks):
            headers['Authorization'] = f"Bearer {toks.get('access_token')}"
            if method.upper() == 'POST':
                resp = requests.post(url, headers=headers, json=payload)
            else:
                resp = requests.get(url, headers=headers)

    return resp

def create_invoice(toks, envs):
    payload = {
        "Line": [
            {
                "DetailType": "SalesItemLineDetail",
                "Amount": 500.0,
                "SalesItemLineDetail": {
                    "ItemRef": {
                        "name": "Services",
                        "value": "1"
                    }
                }
            }
        ],
        "CustomerRef": {
            "value": "1"
        }
    }
    resp = make_qb_request('POST', 'invoice', payload, toks, envs)
    if resp.status_code == 200:
        data = resp.json()
        inv_id = data.get('Invoice', {}).get('Id')
        print(f"Invoice created successfully! ID: {inv_id}")
        return inv_id
    else:
        print(f"Failed to create invoice: {resp.status_code} {resp.text}")
        return None

def create_sales_receipt(toks, envs):
    payload = {
        "Line": [
            {
                "Amount": 150.0,
                "DetailType": "SalesItemLineDetail",
                "SalesItemLineDetail": {
                    "ItemRef": {
                        "name": "Services",
                        "value": "1"
                    }
                }
            }
        ],
        "CustomerRef": {
            "value": "1"
        }
    }
    resp = make_qb_request('POST', 'salesreceipt', payload, toks, envs)
    if resp.status_code == 200:
        data = resp.json()
        rcpt_id = data.get('SalesReceipt', {}).get('Id')
        print(f"SalesReceipt created successfully! ID: {rcpt_id}")
        return rcpt_id
    else:
        print(f"Failed to create sales receipt: {resp.status_code} {resp.text}")
        return None

def main():
    envs = load_env()
    toks = load_tokens()
    
    if not toks:
        print("No tokens found. Authenticate first.")
        sys.exit(1)
        
    print("Starting sync...")
    create_invoice(toks, envs)
    create_sales_receipt(toks, envs)
    print("Sync complete.")

if __name__ == '__main__':
    main()
