import requests
token = "test_token_or_none"
# since we can't easily auth, let's just make a dummy request to see what the server complains about
r = requests.post("http://localhost:8000/api/v1/positions/1/interview-kit/generate")
print(r.status_code, r.text)
