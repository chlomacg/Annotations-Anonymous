\connect "AAdb"


CREATE TABLE public.draft (
    author_id uuid NOT NULL,
    author_handle character varying(24) NOT NULL,
    content jsonb NOT NULL,
    times_edited timestamp with time zone[] NOT NULL
);


ALTER TABLE public.draft OWNER TO postgres;

--
-- Name: post; Type: TABLE; Schema: public; Owner: chloe
--

CREATE TABLE public.post (
    id uuid NOT NULL,
    author_id uuid,
    author_handle character varying(24),
    author_display_name character varying(40),
    time_created timestamp with time zone,
    content jsonb,
    posts_in_thread uuid[],
    index_in_thread smallint,
    replies uuid[],
    reposted_by uuid[],
    liked_by uuid[]
);


ALTER TABLE public.post OWNER TO postgres;

COPY public.post (id, author_id, author_handle, author_display_name, time_created, content, posts_in_thread, index_in_thread, replies, reposted_by, liked_by) FROM stdin;
01234567-0123-0123-0123-0123456789ab	01234567-0123-0123-0123-0123456789ab	simplebutnoteasy	Bill W	1969-12-31 17:00:00-05	{"content": "hello world"}	\N	\N	\N	\N	\N
\.


--
-- Name: post post_pkey; Type: CONSTRAINT; Schema: public; Owner: chloe
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_pkey PRIMARY KEY (id);


