"""Small async-friendly document store backed by SQLite.

It implements only the Mongo-style operations used by this application, keeping
the API layer simple while making local development self-contained.
"""

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path


def _matches(document, query):
    for key, expected in (query or {}).items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$gte" in expected and (actual is None or actual < expected["$gte"]):
                return False
        elif actual != expected:
            return False
    return True


@dataclass
class WriteResult:
    matched_count: int = 0
    deleted_count: int = 0


class DocumentCursor:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, length):
        return self.documents[:length]


class Collection:
    def __init__(self, connection, name):
        self.connection = connection
        self.name = name

    def _documents(self):
        rows = self.connection.execute(
            "SELECT row_id, document FROM documents WHERE collection = ? ORDER BY row_id",
            (self.name,),
        ).fetchall()
        return [(row[0], json.loads(row[1])) for row in rows]

    async def find_one(self, query, projection=None):
        for _, document in self._documents():
            if _matches(document, query):
                return document
        return None

    def find(self, query=None, projection=None):
        return DocumentCursor(
            [document for _, document in self._documents() if _matches(document, query)]
        )

    async def insert_one(self, document):
        self.connection.execute(
            "INSERT INTO documents (collection, document) VALUES (?, ?)",
            (self.name, json.dumps(document, default=str)),
        )
        self.connection.commit()
        return WriteResult(matched_count=1)

    async def delete_many(self, query):
        ids = [row_id for row_id, doc in self._documents() if _matches(doc, query)]
        self._delete_ids(ids)
        return WriteResult(deleted_count=len(ids))

    async def delete_one(self, query):
        ids = [row_id for row_id, doc in self._documents() if _matches(doc, query)][:1]
        self._delete_ids(ids)
        return WriteResult(deleted_count=len(ids))

    def _delete_ids(self, ids):
        if ids:
            self.connection.executemany(
                "DELETE FROM documents WHERE row_id = ?", [(row_id,) for row_id in ids]
            )
            self.connection.commit()

    async def update_one(self, query, update):
        for row_id, document in self._documents():
            if _matches(document, query):
                document.update(update.get("$set", {}))
                self.connection.execute(
                    "UPDATE documents SET document = ? WHERE row_id = ?",
                    (json.dumps(document, default=str), row_id),
                )
                self.connection.commit()
                return WriteResult(matched_count=1)
        return WriteResult()

    async def count_documents(self, query):
        return sum(1 for _, document in self._documents() if _matches(document, query))

    def aggregate(self, pipeline):
        # The app only groups trips by status for its dashboard chart.
        counts = {}
        for _, document in self._documents():
            status = document.get("status")
            counts[status] = counts.get(status, 0) + 1
        return DocumentCursor([{"_id": key, "count": value} for key, value in counts.items()])


class Database:
    def __init__(self, path):
        db_path = Path(path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(db_path, check_same_thread=False)
        self.connection.execute(
            """CREATE TABLE IF NOT EXISTS documents (
                row_id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection TEXT NOT NULL,
                document TEXT NOT NULL
            )"""
        )
        self.connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection)"
        )
        self.connection.commit()

    def __getattr__(self, name):
        return Collection(self.connection, name)

    def close(self):
        self.connection.close()
