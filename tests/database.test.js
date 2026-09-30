import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("migrations enforce owner isolation, atomic ordering and idempotent listening time", async () => {
  const database = new PGlite();
  try {
    await database.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`,
    );
    for (const file of [
      "202609300001_wavecast.sql",
      "202609300002_collections_insights.sql",
    ])
      await database.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await database.exec(
      `set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; insert into public.collections(id,user_id,name) values ('33333333-3333-4333-8333-333333333333',auth.uid(),'Morning');`,
    );
    for (const uuid of ["one", "two"])
      await database.query(
        "select public.add_collection_station($1,$2::jsonb)",
        [
          "33333333-3333-4333-8333-333333333333",
          JSON.stringify({
            stationuuid: uuid,
            name: uuid,
            url_resolved: "https://radio.test/live",
          }),
        ],
      );
    const { rows } = await database.query(
      "select id from public.collection_stations order by position",
    );
    await database.query("select public.reorder_collection($1,$2::uuid[])", [
      "33333333-3333-4333-8333-333333333333",
      rows.map((row) => row.id).reverse(),
    ]);
    assert.equal(
      (
        await database.query(
          "select station_uuid from public.collection_stations order by position",
        )
      ).rows[0].station_uuid,
      "two",
    );
    await assert.rejects(
      database.query("select public.reorder_collection($1,$2::uuid[])", [
        "33333333-3333-4333-8333-333333333333",
        [rows[0].id, rows[0].id],
      ]),
    );
    for (const seconds of [30, 20, 45])
      await database.query(
        `select public.record_listening_session('44444444-4444-4444-8444-444444444444','one','One','France','jazz',now()-interval '60 seconds',$1)`,
        [seconds],
      );
    assert.equal(
      (await database.query("select seconds from public.listening_sessions"))
        .rows[0].seconds,
      45,
    );
    await database.exec(
      `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';`,
    );
    for (const table of [
      "collections",
      "collection_stations",
      "listening_sessions",
    ])
      assert.equal(
        (await database.query(`select * from public.${table}`)).rows.length,
        0,
      );
    await assert.rejects(
      database.query("select public.reorder_collection($1,$2::uuid[])", [
        "33333333-3333-4333-8333-333333333333",
        rows.map((row) => row.id),
      ]),
    );
    await assert.rejects(
      database.query("select public.add_collection_station($1,$2::jsonb)", [
        "33333333-3333-4333-8333-333333333333",
        JSON.stringify({
          stationuuid: "three",
          url_resolved: "https://radio.test",
        }),
      ]),
    );
    await assert.rejects(
      database.exec(
        `insert into public.collections(user_id,name) values ('11111111-1111-4111-8111-111111111111','Intruder')`,
      ),
    );
    await assert.rejects(
      database.exec(
        `insert into public.collection_stations(collection_id,user_id,station_uuid,station_data) values ('33333333-3333-4333-8333-333333333333',auth.uid(),'intruder','{}')`,
      ),
    );
    await database.exec(
      `set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';delete from public.collections where id='33333333-3333-4333-8333-333333333333';`,
    );
    assert.equal(
      (await database.query("select * from public.collection_stations")).rows
        .length,
      0,
    );
  } finally {
    await database.close();
  }
});
