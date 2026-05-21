const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query = '', chain = 'ethereum', maxPrice = 100 } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    let chainWhere = '';
    if (chain === 'ethereum') {
      chainWhere = "AND chain = 'ethereum'";
    } else if (chain === 'tezos') {
      chainWhere = "AND chain = 'tezos'";
    }

    const searchText = `%${query}%`;
    
    const result = await sql`
      SELECT 
        id, contract_address, token_id, title, description,
        image_url, creator_name, collection_name, platform,
        chain, price_eth, price_xtz, floor_price_eth, floor_price_xtz,
        marketplace_url, ipfs_hash, created_at
      FROM trashart_nfts
      WHERE (
        title ILIKE ${searchText}
        OR creator_name ILIKE ${searchText}
        OR collection_name ILIKE ${searchText}
        OR description ILIKE ${searchText}
      )
      ${chainWhere === "AND chain = 'ethereum'" ? sql`AND chain = 'ethereum'` : chainWhere === "AND chain = 'tezos'" ? sql`AND chain = 'tezos'` : sql``}
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
};
