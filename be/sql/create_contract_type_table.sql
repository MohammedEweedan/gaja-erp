-- Create ContractType table for HR module
-- Run this script in your SQL Server database (gj)

USE gj;
GO

-- Check if table exists and drop if needed (optional, comment out if you want to preserve data)
-- IF OBJECT_ID('dbo.ContractType', 'U') IS NOT NULL
--     DROP TABLE dbo.ContractType;
-- GO

-- Create the ContractType table
CREATE TABLE ContractType (
    id_contract_type INT IDENTITY(1,1) PRIMARY KEY,
    contract_name NVARCHAR(100) NOT NULL,
    contract_code NVARCHAR(50) NULL,
    description NVARCHAR(MAX) NULL
);
GO

-- Insert some sample data (optional)
INSERT INTO ContractType (contract_name, contract_code, description)
VALUES 
    ('Permanent Full-Time', 'PFT', 'Full-time permanent employment contract'),
    ('Temporary', 'TEMP', 'Fixed-term temporary contract'),
    ('Part-Time', 'PT', 'Part-time employment contract'),
    ('Contractor', 'CONT', 'Independent contractor agreement'),
    ('Internship', 'INTERN', 'Internship or training contract');
GO

-- Verify the table was created
SELECT * FROM ContractType;
GO
