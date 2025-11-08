-- ==================== RLS POLICIES FOR CHAT HISTORY TABLES ====================

-- Enable RLS on chat_conversations table
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_messages table
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ==================== POLICIES FOR chat_conversations ====================

-- Users can SELECT their own conversations
CREATE POLICY "Users can view their own conversations" 
ON chat_conversations 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can INSERT their own conversations
CREATE POLICY "Users can insert their own conversations" 
ON chat_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own conversations
CREATE POLICY "Users can update their own conversations" 
ON chat_conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can DELETE their own conversations
CREATE POLICY "Users can delete their own conversations" 
ON chat_conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================== POLICIES FOR chat_messages ====================

-- Users can SELECT messages from their own conversations
CREATE POLICY "Users can view messages from their conversations" 
ON chat_messages 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can INSERT messages to their own conversations
CREATE POLICY "Users can insert messages to their conversations" 
ON chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE messages in their own conversations
CREATE POLICY "Users can update messages in their conversations" 
ON chat_messages 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can DELETE messages from their own conversations
CREATE POLICY "Users can delete messages from their conversations" 
ON chat_messages 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================== RLS POLICIES FOR CONTRACTOR PROFILES ====================

-- Enable RLS on contractor_profiles table
ALTER TABLE contractor_profiles ENABLE ROW LEVEL SECURITY;

-- ==================== POLICIES FOR contractor_profiles ====================

-- Users can SELECT their own profile
CREATE POLICY "Users can view their own profile" 
ON contractor_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can INSERT their own profile
CREATE POLICY "Users can insert their own profile" 
ON contractor_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own profile
CREATE POLICY "Users can update their own profile" 
ON contractor_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can DELETE their own profile
CREATE POLICY "Users can delete their own profile" 
ON contractor_profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================== RLS POLICIES FOR PROJECTS AND DOCUMENTS ====================

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ==================== POLICIES FOR projects ====================

-- Users can SELECT their own projects
CREATE POLICY "Users can view their own projects" 
ON projects 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can INSERT their own projects
CREATE POLICY "Users can insert their own projects" 
ON projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own projects
CREATE POLICY "Users can update their own projects" 
ON projects 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can DELETE their own projects
CREATE POLICY "Users can delete their own projects" 
ON projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================== POLICIES FOR documents ====================

-- Users can SELECT documents from their own projects
CREATE POLICY "Users can view documents from their projects" 
ON documents 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can INSERT documents to their own projects
CREATE POLICY "Users can insert documents to their projects" 
ON documents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE documents in their own projects
CREATE POLICY "Users can update documents in their projects" 
ON documents 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can DELETE documents from their own projects
CREATE POLICY "Users can delete documents from their projects" 
ON documents 
FOR DELETE 
USING (auth.uid() = user_id);

-- ==================== GRANT PERMISSIONS ====================

-- Grant necessary permissions to authenticated users
GRANT ALL ON TABLE chat_conversations TO authenticated;
GRANT ALL ON TABLE chat_messages TO authenticated;
GRANT ALL ON TABLE contractor_profiles TO authenticated;
GRANT ALL ON TABLE projects TO authenticated;
GRANT ALL ON TABLE documents TO authenticated;