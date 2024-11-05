/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class InteractionInput {
  geneIDs: string[];
  interactionType: string;
  minScore: number;
}

export class Gene {
  ALS?: Nullable<JSON>;
  Description?: Nullable<string>;
  FTD?: Nullable<JSON>;
  Gene_name?: Nullable<string>;
  ID: string;
  OI?: Nullable<JSON>;
  PSP?: Nullable<JSON>;
  common?: Nullable<JSON>;
  hgnc_gene_id?: Nullable<string>;
  hgnc_gene_symbol?: Nullable<string>;
}

export class GeneBase {
  Description?: Nullable<string>;
  Gene_name?: Nullable<string>;
  ID: string;
}

export class GeneInteraction {
  gene1: string;
  gene2: string;
  score: number;
}

export class GeneInteractionOutput {
  genes: GeneBase[];
  links?: Nullable<GeneInteraction[]>;
}

export abstract class IQuery {
  abstract getGeneInteractions(
    input: InteractionInput,
    order: number,
  ): GeneInteractionOutput | Promise<GeneInteractionOutput>;

  abstract getGenes(geneIDs: string[]): Gene[] | Promise<Gene[]>;

  abstract sayHello(): Nullable<string> | Promise<Nullable<string>>;
}

export type JSON = any;
type Nullable<T> = T | null;
