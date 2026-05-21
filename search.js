// api/search.js
// Search endpoint: /api/search
// POST request with { query, chain, maxPrice }
// Returns array of matching TRASHART NFTs

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query = '', chain = 'ethereum', maxPrice = 100 } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    let chainFilter = '';
    if (chain === 'ethereum') {
      chainFilter = "AND chain = 'ethereum'";
    } else if (chain === 'tezos') {
      chainFilter = "AND chain = 'tezos'";
    }
    // if chain === 'both', no filter

    // Full-text search on description/title
    // Also match exact collection/creator names
    const searchTerms = query.split(' ').filter(t => t.length > 0).join(' & ');
    
    const result = await sql`
      SELECT 
        id, contract_address, token_id, title, description,
        image_url, creator_name, collection_name, platform,
        chain, price_eth, price_xtz, floor_price_eth, floor_price_xtz,
        marketplace_url, ipfs_hash, created_at
      FROM trashart_nfts
      WHERE (
        search_text @@ to_tsquery('english', ${searchTerms})
        OR title ILIKE ${'%' + query + '%'}
        OR creator_name ILIKE ${'%' + query + '%'}
        OR collection_name ILIKE ${'%' + query + '%'}
      )
      ${sql.unsafe(chainFilter)}
      AND (price_eth IS NULL OR price_eth <= ${maxPrice})
      AND (price_xtz IS NULL OR price_xtz <= ${maxPrice})
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return res.status(200).json({
      results: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
