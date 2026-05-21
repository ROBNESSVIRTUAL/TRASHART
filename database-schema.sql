-- Database schema for toter.io TRASHART NFT index
-- Run this in Vercel Postgres to initialize the database

-- Create table for TRASHART NFTs
CREATE TABLE IF NOT EXISTS trashart_nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Blockchain identifiers
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  chain TEXT NOT NULL CHECK (chain IN ('ethereum', 'tezos')),
  platform TEXT NOT NULL CHECK (platform IN ('opensea', 'objkt', 'superrare')),
  
  -- NFT metadata
  title TEXT,
  description TEXT,
  image_url TEXT,
  creator_name TEXT,
  collection_name TEXT,
  
  -- Pricing
  price_eth DECIMAL(20, 8),
  price_xtz DECIMAL(20, 2),
  floor_price_eth DECIMAL(20, 8),
  floor_price_xtz DECIMAL(20, 2),
  
  -- External links
  marketplace_url TEXT,
  ipfs_hash TEXT,
  
  -- Full-text search
  search_text TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint on contract + token_id
  UNIQUE(contract_address, token_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trashart_search 
  ON trashart_nfts 
  USING GIN (to_tsvector('english', search_text));

CREATE INDEX IF NOT EXISTS idx_trashart_chain 
  ON trashart_nfts (chain);

CREATE INDEX IF NOT EXISTS idx_trashart_platform 
  ON trashart_nfts (platform);

CREATE INDEX IF NOT EXISTS idx_trashart_creator 
  ON trashart_nfts (creator_name);

CREATE INDEX IF NOT EXISTS idx_trashart_collection 
  ON trashart_nfts (collection_name);

CREATE INDEX IF NOT EXISTS idx_trashart_title 
  ON trashart_nfts (title);

CREATE INDEX IF NOT EXISTS idx_trashart_created 
  ON trashart_nfts (created_at DESC);

-- Create table for crawl logs (optional, for monitoring)
CREATE TABLE IF NOT EXISTS crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_type TEXT NOT NULL, -- 'opensea', 'objkt'
  items_found INT,
  items_stored INT,
  status TEXT,
  error_message TEXT,
  crawled_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_crawled_at 
  ON crawl_logs (crawled_at DESC);

-- Sample data for testing (optional)
-- INSERT INTO trashart_nfts (
--   contract_address, token_id, chain, platform, title, description,
--   image_url, creator_name, collection_name, marketplace_url, search_text
-- ) VALUES (
--   '0x1234567890abcdef', '1', 'ethereum', 'opensea',
--   'Chaotic Dream #1', 'A #TRASHART piece exploring digital chaos',
--   'https://example.com/image.jpg', 'Artist Name', 'Chaos Collection',
--   'https://opensea.io/...', 'chaotic dream trashart piece exploring digital chaos'
-- );
