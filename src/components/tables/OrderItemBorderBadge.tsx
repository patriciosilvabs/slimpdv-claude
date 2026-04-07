/**
 * Exibe badge de borda em itens de pedido na tela de Mesas.
 * Extrai info de borda de extras ou sub_extras, com fallback por texto
 * para casos em que a categorização não veio corretamente.
 */
export function OrderItemBorderBadge({ item }: { item: any }) {
  const hasBorderText = (value?: string | null) => {
    const text = value?.toLowerCase() ?? '';
    return text.includes('borda') || text.includes('massa');
  };

  const getDisplayName = (value?: string | null) => {
    if (!value) return null;

    const parts = value.split(':');
    return parts.length > 1 ? parts[1].trim() : value.trim();
  };

  const borderExtra = item.extras?.find(
    (extra: any) => extra.kds_category === 'border' || hasBorderText(extra.extra_name)
  );

  const subBorderExtra = !borderExtra && item.sub_items
    ? item.sub_items
        .flatMap((subItem: any) => subItem.sub_extras || [])
        .find(
          (subExtra: any) =>
            subExtra.kds_category === 'border' ||
            hasBorderText(subExtra.group_name) ||
            hasBorderText(subExtra.option_name)
        )
    : null;

  const displayName = borderExtra
    ? getDisplayName(borderExtra.extra_name)
    : subBorderExtra
      ? getDisplayName(subBorderExtra.option_name) || getDisplayName(subBorderExtra.group_name)
      : null;

  if (!displayName) return null;

  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary animate-pulse">
      🟡 Borda: {displayName}
    </div>
  );
}
