-- Create audit_trail table
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255),
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on audit_trail
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Allow admins and analysts to read audit_trail
CREATE POLICY "Admins and analysts can read audit trail"
    ON audit_trail
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'analyst', 'owner')
        )
    );

-- Prevent updates/deletes on audit_trail
CREATE POLICY "No one can update or delete audit trail"
    ON audit_trail
    FOR UPDATE
    USING (false);

CREATE POLICY "No one can update or delete audit trail - delete"
    ON audit_trail
    FOR DELETE
    USING (false);

-- Update user_roles if necessary, assuming it already exists based on other context,
-- but ensure admin/analyst roles can manage it
-- Give admins access to view all user_roles
CREATE POLICY IF NOT EXISTS "Admins can read all user roles"
    ON user_roles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner')
        )
    );

-- Give admins access to manage user_roles
CREATE POLICY IF NOT EXISTS "Admins can insert user roles"
    ON user_roles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner')
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can update user roles"
    ON user_roles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner')
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can delete user roles"
    ON user_roles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner')
        )
    );

