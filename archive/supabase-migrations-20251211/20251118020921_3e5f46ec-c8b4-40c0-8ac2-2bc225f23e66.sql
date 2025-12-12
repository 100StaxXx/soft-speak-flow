-- Add unique constraint for daily_check_ins upsert
ALTER TABLE daily_check_ins 
ADD CONSTRAINT daily_check_ins_user_date_type_unique 
UNIQUE (user_id, check_in_date, check_in_type);