import hmac
import hashlib
import json
import sys

def generate_signature(webhook_secret, payload):
    """
    Generates an HMAC-SHA256 signature for a given payload and secret.
    """
    # Ensure payload is a JSON string
    if isinstance(payload, dict):
        payload_str = json.dumps(payload, separators=(',', ':'))
    else:
        payload_str = payload

    # Encode the secret and payload
    secret_bytes = webhook_secret.encode('utf-8')
    payload_bytes = payload_str.encode('utf-8')

    # Create HMAC-SHA256 hash
    h = hmac.new(secret_bytes, payload_bytes, hashlib.sha256)
    return h.hexdigest()

if __name__ == "__main__":
    # Get webhook secret from command line or prompt for it
    if len(sys.argv) > 1:
        webhook_secret = sys.argv[1]
    else:
        webhook_secret = input("Enter your LemonSqueezy webhook secret: ")

    # Sample test payload
    payload = {
        "meta": {
            "event_name": "subscription_created",
            "custom_data": {
                "plan": "pro",
                "user_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
            }
        },
        "data": {
            "id": "sub_test_123",
            "type": "subscriptions",
            "attributes": {
                "customer_id": "cust_test_456",
                "status": "active",
                "plan_id": 12345,
                "custom_data": {
                    "plan": "pro"
                }
            }
        }
    }

    # Generate and print the signature
    signature = generate_signature(webhook_secret, payload)
    print(f"\nGenerated x-signature: {signature}")
    
    # Print curl command for easy copy-paste
    payload_json = json.dumps(payload, separators=(',', ':'))
    print("\nCURL command to test webhook:")
    print(f"""
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "x-signature: {signature}" \\
  -d '{payload_json}' \\
  https://anuexdfqfiibzzmspewa.supabase.co/functions/v1/lemonsqueezy-webhook
""")