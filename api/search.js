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
    const searchText = `%${query}%`;
    
    let results;
    
    if (chain === 'ethereum') {
      results = await sql`
        SELECT * FROM trashart_nfts
        WHERE chain = 'ethereum'
        AND (title ILIKE ${searchText} OR creator_name ILIKE ${searchText})
        LIMIT 50
      `;
    } else if (chain === 'tezos') {
      results = await sql`
        SELECT * FROM trashart_nfts
        WHERE chain = 'tezos'
        AND (title ILIKE ${searchText} OR creator_name ILIKE ${searchText})
        LIMIT 50
      `;
    } else {
      results = await sql`
        SELECT * FROM trashart_nfts
        WHERE (title ILIKE ${searchText} OR creator_name ILIKE ${searchText})
        LIMIT 50
      `;
    }

    return res.status(200).json({
      results: results.rows || [],
      count: (results.rows || []).length
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
};
