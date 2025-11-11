// Seed script to populate sample campus party events
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: false
});

const sampleEvents = [
  {
    title: 'Sigma Phi Friday Bash',
    description: 'Kick off the weekend with a classic fraternity house party featuring local DJs and glow sticks.',
    host_type: 'fraternity',
    location_lat: 42.0226,
    location_lng: -93.6463,
    start_time: () => new Date(Date.now() + 1000 * 60 * 60 * 24),
    end_time: () => new Date(Date.now() + 1000 * 60 * 60 * 30),
    tags: ['Greek life', 'Glow theme', 'Dance floor'],
    theme: 'Glow Night',
    music_type: 'Top 40 + EDM',
    cover_charge: '$5 before 10pm',
    is_byob: false
  },
  {
    title: 'East Campus Porch Jam',
    description: 'House show with live indie bands, bonfire, and backyard games. BYOB encouraged.',
    host_type: 'house',
    location_lat: 42.0289,
    location_lng: -93.6332,
    start_time: () => new Date(Date.now() + 1000 * 60 * 60 * 48),
    end_time: () => new Date(Date.now() + 1000 * 60 * 60 * 53),
    tags: ['Live music', 'Backyard', 'Bonfire friendly'],
    theme: 'Porch Sessions',
    music_type: 'Indie rock',
    cover_charge: 'Free',
    is_byob: true
  },
  {
    title: 'Campus Underground EDM Night',
    description: 'Student DJ collective takes over the rec center annex for an all-campus dance event with laser show.',
    host_type: 'club',
    location_lat: 42.0255,
    location_lng: -93.6469,
    start_time: () => new Date(Date.now() + 1000 * 60 * 60 * 72),
    end_time: () => new Date(Date.now() + 1000 * 60 * 60 * 78),
    tags: ['Campus rec', 'Laser show', 'All ages'],
    theme: 'Future Beats',
    music_type: 'EDM',
    cover_charge: '$10',
    is_byob: false
  }
];

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Seeding sample events...');
    await client.query('BEGIN');

    for (const event of sampleEvents) {
      const insertQuery = `
        INSERT INTO Events (
          title,
          description,
          host_type,
          location_lat,
          location_lng,
          start_time,
          end_time,
          tags,
          theme,
          music_type,
          cover_charge,
          is_byob,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        ON CONFLICT DO NOTHING
        RETURNING event_id;
      `;

      const result = await client.query(insertQuery, [
        event.title,
        event.description,
        event.host_type,
        event.location_lat,
        event.location_lng,
        event.start_time(),
        event.end_time(),
        event.tags,
        event.theme,
        event.music_type,
        event.cover_charge,
        event.is_byob
      ]);

      if (result.rows.length) {
        console.log(`  ✓ Inserted event: ${event.title}`);
      } else {
        console.log(`  • Skipped (already exists): ${event.title}`);
      }
    }

    await client.query('COMMIT');
    const countResult = await client.query('SELECT COUNT(*) FROM Events');
    console.log(`\n✅ Database now has ${countResult.rows[0].count} events.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
