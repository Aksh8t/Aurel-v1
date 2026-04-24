from collections import Counter

from qdrant_client.models import FieldCondition, Filter, MatchAny, SearchParams

from services.embeddings import embed_text, ensure_collection, qdrant_client


def _keyword_overlap(query: str, text: str) -> int:
    query_terms = [term.lower() for term in query.split() if len(term) > 2]
    text_terms = Counter(term.lower().strip(".,!?") for term in text.split())
    return sum(1 for term in query_terms if term in text_terms)


async def hybrid_search(
    workspace_id: str,
    query: str,
    limit: int = 40,
    source_types: list[str] | None = None,
) -> list[dict]:
    vector = await embed_text(query)
    collection_name = ensure_collection(workspace_id)
    filters = None
    if source_types:
        filters = Filter(
            must=[FieldCondition(key="source_type", match=MatchAny(any=source_types))]
        )

    results = qdrant_client.search(
        collection_name=collection_name,
        query_vector=vector,
        query_filter=filters,
        limit=limit,
        search_params=SearchParams(hnsw_ef=128, exact=False),
    )

    ranked: list[dict] = []
    for item in results:
        payload = item.payload or {}
        text = str(payload.get("text", ""))
        semantic_score = float(item.score)
        keyword_score = _keyword_overlap(query, text) * 0.03
        ranked.append(
            {
                "chunk_id": payload.get("chunk_id"),
                "workspace_id": payload.get("workspace_id"),
                "data_source_id": payload.get("data_source_id"),
                "source_type": payload.get("source_type"),
                "source_name": payload.get("source_name"),
                "text": text,
                "created_at": payload.get("created_at"),
                "score": semantic_score + keyword_score,
            }
        )

    ranked.sort(key=lambda result: result["score"], reverse=True)
    return ranked


def build_context(chunks: list[dict], limit: int = 30) -> str:
    lines: list[str] = []
    for chunk in chunks[:limit]:
        lines.append(
            "\n".join(
                [
                    f"Source: {chunk.get('source_name', 'Unknown source')}",
                    f"Source Type: {chunk.get('source_type', 'unknown')}",
                    f"Created At: {chunk.get('created_at', 'unknown')}",
                    f"Content: {chunk.get('text', '')}",
                ]
            )
        )
    return "\n\n".join(lines)
