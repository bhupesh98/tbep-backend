import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLResolveInfo, Kind, SelectionSetNode, FieldNode } from 'graphql';

interface DiseaseNamesOptions {
  fieldName?: string;
  depth: number;
}

export const DiseaseNames = createParamDecorator(
  (options: DiseaseNamesOptions = { depth: 0 }, context: ExecutionContext): string[] => {
    if (options.depth < 0 || (options.fieldName && options.depth === 0)) {
      throw new Error('Invalid options provided for DiseaseNames decorator');
    }
    const ctx = GqlExecutionContext.create(context);
    const info: GraphQLResolveInfo = ctx.getInfo<GraphQLResolveInfo>();
    const diseaseNames = [];
    info.fieldNodes.forEach((node) => {
      const selectionSet = node.selectionSet;
      if (selectionSet) {
        diseaseNames.push(...getDiseaseNames(selectionSet, options));
      }
    });
    return diseaseNames || [];
  },
);

function getDiseaseNames(selectionSet: SelectionSetNode, options: DiseaseNamesOptions): string[] {
  const diseaseNames = [];
  if (!options.fieldName || options.depth === 0) {
    return selectionSet.selections
      .map((selection: FieldNode) => selection.name.value)
      .filter((name) => {
        return !['ID', 'Gene_name', 'Description', 'common', 'hgnc_gene_id', 'hgnc_gene_symbol'].includes(name);
      });
  }
  selectionSet.selections.forEach((selection) => {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === options.fieldName) {
        const selectionSet = selection.selectionSet;
        if (selectionSet && options.depth > 0) {
          diseaseNames.push(
            ...getDiseaseNames(selectionSet, {
              fieldName: options.fieldName,
              depth: options.depth - 1,
            }),
          );
        }
      }
    }
  });
  return diseaseNames;
}
