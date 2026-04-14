import os
from supabase import create_client, Client

url = "https://xnwxgejonkdvsxistdjj.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhud3hnZWpvbmtkdnN4aXN0ZGpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIzNTg2OCwiZXhwIjoyMDkwODExODY4fQ.9NYEBY7bPX_k3T22rxNPFBmSKe1nXWePgeSUUPKKadc"
supabase: Client = create_client(url, key)

try:
    # Just selecting from multiple potential names to see what exists, or we can query information_schema if using postgres
    res = supabase.table('workers').select('*').limit(1).execute()
    print("workers table columns:", res.data[0].keys() if len(res.data) > 0 else 'empty')
except Exception as e:
    print(e)
