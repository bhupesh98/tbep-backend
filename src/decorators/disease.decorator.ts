import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { type FieldNode, type GraphQLResolveInfo, Kind, type SelectionSetNode } from 'graphql';

interface DiseaseNamesOptions {
  fieldName?: string;
  depth: number;
}

export const DiseaseNames = createParamDecorator(
  (options: DiseaseNamesOptions = { depth: 0 }, context: ExecutionContext): [Array<string>, boolean] => {
    if (options.depth < 0 || (options.fieldName && options.depth === 0)) {
      throw new Error('Invalid options provided for DiseaseNames decorator');
    }
    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo<GraphQLResolveInfo>();
    const diseaseNames = [];
    let isCommon = false;
    info.fieldNodes.forEach((node) => {
      const selectionSet = node.selectionSet;
      if (selectionSet) {
        const result = getDiseaseNames(selectionSet, options);
        diseaseNames.push(...result[0]);
        isCommon ||= result[1];
      }
    });
    return [diseaseNames, isCommon];
  },
);

function getDiseaseNames(selectionSet: SelectionSetNode, options: DiseaseNamesOptions): [string[], boolean] {
  const diseaseNames = [];
  let isCommon = false;
  if (!options.fieldName || options.depth === 0) {
    const result = selectionSet.selections
      .map((selection: FieldNode) => selection.name.value)
      .filter((name) => {
        if (name === 'common') isCommon = true;
        return !['ID', 'Gene_name', 'Description', 'common', 'hgnc_gene_id', 'hgnc_gene_symbol'].includes(name);
      });
    return [result, isCommon];
  }
  selectionSet.selections.forEach((selection) => {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === options.fieldName) {
        const selectionSet = selection.selectionSet;
        if (selectionSet && options.depth > 0) {
          const result = getDiseaseNames(selectionSet, {
            fieldName: options.fieldName,
            depth: options.depth - 1,
          });
          isCommon ||= result[1];
          diseaseNames.concat(result[0]);
        }
      }
    }
  });
  return [diseaseNames, isCommon];
}
