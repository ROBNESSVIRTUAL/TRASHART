// api/crawl.js
// Crawler endpoint: /api/crawl
// Crawls OpenSea + Objkt for #TRASHART pieces
// Can be triggered manually or via Vercel Cron (requires setup)

const { sql } = require('@vercel/postgres');

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || '';
const OBJKT_API_URL = 'https://api.objkt.com/v4/search';
const OPENSEA_API_URL = 'https://api.opensea.io/v2';

async function crawlOpenSea() {
  console.log('🔍 Crawling OpenSea...');
  const results = [];
  
  try {
    // OpenSea REST API v2 search by collection name containing #TRASHART
    // Note: This searches for collections/items, we need to filter for #TRASHART in description
    const headers = {
      'Accept': 'application/json',
      ...(OPENSEA_API_KEY && { 'X-API-KEY': OPENSEA_API_KEY })
    };

    // Search for collections with TRASHART
    const collResponse = await fetch(
      `${OPENSEA_API_URL}/collections?query=%23TRASHART&limit=50`,
      { headers }
    );

    if (!collResponse.ok) {
      console.error('OpenSea collections error:', collResponse.status);
      return results;
    }

    const collData = await collResponse.json();
    const collections = collData.collections || [];

    // For each collection, fetch items
    for (const collection of collections.slice(0, 10)) {
      console.log(`  Fetching items from collection: ${collection.name}`);
      
      try {
        const itemsResponse = await fetch(
          `${OPENSEA_API_URL}/collection/${collection.collection}/items?limit=50`,
          { headers }
        );

        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          const items = itemsData.results || [];

          for (const item of items) {
            // Check if description contains #TRASHART
            if (item.description && item.description.includes('#TRASHART')) {
              results.push({
                contract: item.contract,
                tokenId: item.identifier,
                title: item.name || 'Untitled',
                description: item.description,
                imageUrl: item.image_url,
                creator: item.creator?.user?.username || 'Unknown',
                collection: collection.name,
                platform: 'opensea',
                chain: 'ethereum',
                priceEth: item.floor_price,
                marketplaceUrl: item.opensea_url || `https://opensea.io/assets/ethereum/${item.contract}/${item.identifier}`,
                ipfsHash: extractIpfsHash(item.image_url)
              });
            }
          }
        }
      } catch (err) {
        console.error(`  Error fetching items for ${collection.name}:`, err.message);
      }

      // Rate limit: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (err) {
    console.error('OpenSea crawl error:', err.message);
  }

  console.log(`✓ OpenSea: found ${results.length} items`);
  return results;
}

async function crawlObjkt() {
  console.log('🔍 Crawling Objkt...');
  const results = [];

  try {
    // Objkt has a GraphQL API, but we can use the search endpoint
    // Search for #TRASHART in descriptions
    const response = await fetch(OBJKT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '#TRASHART',
        filters: {
          // Limit to Tezos chain
          chains: ['tezos']
        },
        limit: 100,
        offset: 0,
        sort: 'recent'
      })
    });

    if (!response.ok) {
      console.error('Objkt API error:', response.status);
      return results;
    }

    const data = await response.json();
    const items = data.results || [];

    for (const item of items) {
      if (item.description && item.description.includes('#TRASHART')) {
        results.push({
          contract: item.fa ? item.fa : '',
          tokenId: item.token_id,
          title: item.name || 'Untitled',
          description: item.description,
          imageUrl: item.display_uri || item.thumbnail_uri,
          creator: item.creator?.name || item.creator?.address || 'Unknown',
          collection: item.collection?.name || 'Unknown',
          platform: 'objkt',
          chain: 'tezos',
          priceXtz: item.price,
          marketplaceUrl: `https://objkt.com/asset/${item.fa}/${item.token_id}`,
          ipfsHash: extractIpfsHash(item.artifact_uri || item.display_uri)
        });
      }
    }

  } catch (err) {
    console.error('Objkt crawl error:', err.message);
  }

  console.log(`✓ Objkt: found ${results.length} items`);
  return results;
}

function extractIpfsHash(url) {
  if (!url) return null;
  const match = url.match(/ipfs:\/\/(.+?)(?:\/|$)/);
  return match ? match[1] : null;
}

async function deduplicateAndStore(allItems) {
  console.log(`💾 Processing ${allItems.length} items...`);
  
  const seen = new Set();
  const unique = [];

  for (const item of allItems) {
    const key = `${item.contract}:${item.tokenId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  console.log(`📦 ${unique.length} unique items to store`);

  let inserted = 0;
  let updated = 0;

  for (const item of unique) {
    try {
      // Upsert: if item exists, update; otherwise insert
      const searchText = `${item.title} ${item.description} ${item.creator} ${item.collection}`.toLowerCase();

      await sql`
        INSERT INTO trashart_nfts (
          contract_address, token_id, title, description,
          image_url, creator_name, collection_name, platform,
          chain, price_eth, price_xtz, marketplace_url,
          ipfs_hash, search_text, created_at, last_updated
        ) VALUES (
          ${item.contract}, ${item.tokenId}, ${item.title}, ${item.description},
          ${item.imageUrl}, ${item.creator}, ${item.collection}, ${item.platform},
          ${item.chain}, ${item.priceEth || null}, ${item.priceXtz || null},
          ${item.marketplaceUrl}, ${item.ipfsHash}, ${searchText},
          NOW(), NOW()
        )
        ON CONFLICT (contract_address, token_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          price_eth = COALESCE(EXCLUDED.price_eth, price_eth),
          price_xtz = COALESCE(EXCLUDED.price_xtz, price_xtz),
          last_updated = NOW()
      `;

      inserted++;
    } catch (err) {
      console.error(`Error storing item ${item.contract}/${item.tokenId}:`, err.message);
    }
  }

  console.log(`✅ Inserted ${inserted} items`);
  return { inserted, updated };
}

module.exports = async function handler(req, res) {  // Check for authorization (optional: via query param or header)
  const token = req.headers['x-crawl-token'] || req.query.token;
  const validToken = process.env.CRAWL_TOKEN;
  
  if (validToken && token !== validToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🚀 Starting TRASHART crawl...');

    // Crawl both platforms
    const openSeaItems = await crawlOpenSea();
    const objktItems = await crawlObjkt();
    
    const allItems = [...openSeaItems, ...objktItems];
    console.log(`📊 Total items found: ${allItems.length}`);

    // Deduplicate and store
    const result = await deduplicateAndStore(allItems);

    return res.status(200).json({
      success: true,
      message: 'Crawl complete',
      total_found: allItems.length,
      inserted: result.inserted,
      updated: result.updated,
      sources: {
        opensea: openSeaItems.length,
        objkt: objktItems.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Crawl failed:', error);
    return res.status(500).json({
      error: 'Crawl failed',
      details: error.message
    });
  }
}
