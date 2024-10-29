export const NEO4J_CONFIG: string = 'NEO4J_CONFIG';
export const NEO4J_DRIVER: string = 'NEO4J_DRIVER';

export const GET_GENES_QUERY: string = `MATCH (g:Gene)
      WHERE g.ID IN $geneIDs OR g.Gene_name IN $geneIDs
      RETURN g`;

export function GENE_INTERACTIONS_QUERY(order: number, interactionType: string): string {
  switch (order) {
    case 0:
      return `MATCH (g:Gene) WHERE g.ID IN $geneIDs
        WITH COLLECT(g) AS genes
        UNWIND genes AS g1
        MATCH (g1:Gene)-[r:${interactionType}]->(g2:Gene)
        WHERE r.score >= $minScore AND elementId(g1) < elementId(g2) AND g2.ID IN $geneIDs
        RETURN COLLECT({gene1: g1.ID, gene2: g2.ID, score: r.score}) AS connections, genes`;
    case 1:
      return `MATCH (g1:Gene)-[r:${interactionType}]->(g2:Gene)
        WHERE g1.ID IN $geneIDs
        AND r.score >= $minScore
        RETURN apoc.coll.toSet(COLLECT(g1) + COLLECT(g2)) AS genes, COLLECT({gene1: g1.ID, gene2: g2.ID, score: r.score}) AS connections
      `;
    default:
      return '';
  }
}

export function FIRST_ORDER_GENES_QUERY(interactionType: string): string {
  return `MATCH (g1:Gene)-[r:${interactionType}]->(g2:Gene)
    WHERE g1.ID IN $geneIDs AND r.score >= $minScore
    RETURN apoc.coll.toSet(COLLECT(g1.ID) + COLLECT(g2.ID)) AS geneIDs`;
}
