# Supabase RLS (Row Level Security) Setup for Chat History

This document explains how to set up Row Level Security (RLS) policies for the chat history tables in Supabase.

## Error Explanation

The error you're seeing:
```
❌ Error saving chat: {
  code: '42501',
  details: null,
  hint: null,
  message: 'new row violates row-level security policy for table "chat_conversations"'
}
```

This occurs because Supabase has Row Level Security enabled on the tables, but the proper policies haven't been configured to allow authenticated users to access their own data.

## Solution

### 1. Execute the RLS Policies SQL

Run the SQL commands in `rls_policies.sql` in your Supabase SQL editor:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `rls_policies.sql`
4. Run the SQL commands

### 2. Verify Table Structure

Make sure your tables have the correct structure:

#### chat_conversations table:
```sql
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  project_id UUID,
  project_name TEXT,
  department TEXT,
  division TEXT,
  status TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### chat_messages table:
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  has_documents BOOLEAN DEFAULT false,
  document_references JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Enable RLS on Tables (if not already done)

If RLS is not already enabled on your tables, you need to enable it:

```sql
-- Enable RLS on chat_conversations table
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_messages table
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
```

## Testing

After setting up the policies, restart your backend server and try saving a chat again. The RLS error should be resolved.

## Additional Notes

- The policies ensure that users can only access their own chat data
- The backend uses a service key which should have admin privileges
- If you continue to have issues, check that your Supabase auth setup is correctly configured