import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB, json } from '../src/db';

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

async function populateDataForDebugging(db: Kysely<DB>) {
  const chloe = {
    id: '019c1b31-7ad1-7a6d-aafa-7d31aebd4547',
    handle: 'mushchlo',
    display: 'Chloe M',
  };
  const billW = {
    id: '019c1b34-1c17-740e-a098-715574c67465',
    handle: 'simplebutnoteasy',
    display: 'Bill W',
  };

  const postOne = {
    id: '000c0fcc-c23a-7aaa-a2cf-af25fd3f301b',
    author_id: chloe.id,
    author_handle: chloe.handle,
    author_display_name: chloe.display,
    time_created: new Date(),
    content: json({
      content: 'Bello',
    }),
    replies: [],
  };
  const postTwo = {
    id: '200c0fcc-c23a-7aaa-a2cf-af25fd3f301b',
    author_id: billW.id,
    author_handle: billW.handle,
    author_display_name: billW.display,
    time_created: new Date(1935, 0),
    content: json({
      content:
        'My friend suggested what then seemed a novel idea. He said, "Why don\'t you choose your own conception of God?"',
    }),
    replies: [],
  };

  const result = await db.insertInto('post').values(postOne).executeTakeFirstOrThrow();
  console.log(result);
  await db.insertInto('post').values(postTwo).execute();

  await db.insertInto('like').values({ post_id: postOne.id, liker_id: chloe.id, timestamp: new Date() }).execute();
  await db.insertInto('repost').values({ post_id: postOne.id, reposter_id: chloe.id, timestamp: new Date() }).execute();
}

populateDataForDebugging(db);
