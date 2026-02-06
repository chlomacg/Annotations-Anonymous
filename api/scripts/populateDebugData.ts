import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from '../src/db';
import { json } from '../src/util';

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
    id: '019c1ffd-4984-7fc6-8d75-553801220ffc',
    author_id: chloe.id,
    author_handle: chloe.handle,
    author_display_name: chloe.display,
    content: json([
      {
        _type: 'block',
        _key: 'c0a7e700e0ca',
        style: 'normal',
        markDefs: [],
        children: [
          {
            _type: 'span',
            _key: '5c5006ef0c7b',
            text: 'H ello',
            marks: [],
          },
        ],
      },
    ]),
  };
  const postTwo = {
    id: '019c1ffc-c072-71a6-b180-c2bb16f60c60',
    author_id: billW.id,
    author_handle: billW.handle,
    author_display_name: billW.display,
    created_at: new Date(1935, 0),
    content: json([
      {
        _type: 'block',
        _key: '102974e449be',
        children: [
          {
            _type: 'span',
            _key: 'fbb373bb8132',
            text: 'My friend suggested what then seemed a novel idea. He said,',
            marks: [],
          },
        ],
        markDefs: [],
        style: 'normal',
      },
      {
        _type: 'block',
        _key: '9d37d42b14e9',
        children: [
          {
            _type: 'span',
            _key: 'fbb373bb8132',
            text: "Why don't you choose your own conception of God?",
            marks: [],
          },
        ],
        markDefs: [],
        style: 'blockquote',
      },
    ]),
  };

  console.log('Writing debug data...');

  await db.insertInto('post').values(postOne).execute();
  await db.insertInto('post').values(postTwo).execute();

  await db.insertInto('like').values({ post_id: postOne.id, liker_id: chloe.id, created_at: new Date() }).execute();
  await db
    .insertInto('repost')
    .values({ post_id: postTwo.id, reposter_id: chloe.id, created_at: new Date() })
    .execute();

  await db.destroy();

  console.log('Debug data written.');
}

populateDataForDebugging(db);
