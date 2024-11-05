export const NEO4J_CONFIG: string = 'NEO4J_CONFIG';
export const NEO4J_DRIVER: string = 'NEO4J_DRIVER';

export function GET_GENES_QUERY(bringAll: boolean): string {
  return `MATCH (g:Gene)
    WHERE g.ID IN $geneIDs OR g.Gene_name IN $geneIDs
    RETURN g ${bringAll ? '' : '{ .ID, .Gene_name, .Description}'}`;
}

export function GENE_INTERACTIONS_QUERY(order: number, interactionType: string): string {
  switch (order) {
    case 0:
      return `MATCH (g:Gene) WHERE g.ID IN $geneIDs
        OPTIONAL MATCH (g1:Gene)-[r:${interactionType}]->(g2:Gene)
        WHERE r.score >= $minScore AND elementId(g1) < elementId(g2) AND g2.ID IN $geneIDs
        RETURN [conn IN COLLECT({gene1: g1.ID, gene2: g2.ID, score: r.score}) WHERE conn.gene2 IS NOT NULL] AS connections, COLLECT(g1 { .ID, .Gene_name, .Description}) AS genes;`;
    case 1:
      return `MATCH (g1:Gene)-[r:${interactionType}]->(g2:Gene)
        WHERE g1.ID IN $geneIDs
        AND r.score >= $minScore
        RETURN apoc.coll.toSet(COLLECT(g1 { .ID, .Gene_name, .Description}) + COLLECT(g2 { .ID, .Gene_name, .Description})) AS genes, COLLECT({gene1: g1.ID, gene2: g2.ID, score: r.score}) AS connections
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

export const DISEASE_DEPENDENT_FIELDS = ['GWAS', 'GDA', 'logFC'];
export const DISEASE_INDEPENDENT_FIELDS = ['pathway', 'Druggability', 'TE', 'database'];
