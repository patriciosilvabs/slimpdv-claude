
# Corrigir: pedido chega e nada aparece no Log de Envio

## Causa raiz confirmada
- O disparo imediato já está acontecendo.
- O `useOrderWebhookListener` detectou o `INSERT` do pedido e chamou `order-webhooks` com `order.created`.
- Em seguida também chamou `order.preparing`.
- As duas respostas foram: `"No webhooks match this order type"`.

```text
Pedido recebido:
- origem: website
- order_type: takeaway

Comportamento atual:
- webhook é invocado
- edge function filtra por order_type
- retorna cedo sem inserir em order_webhook_logs
- a tela de Logs de Envio não mostra nada
```

## Plano de implementação
1. Ajustar `supabase/functions/order-webhooks/index.ts`
   - Registrar uma linha de log para toda tentativa de saída, mesmo quando o envio for bloqueado por filtro.
   - Diferenciar claramente:
     - enviado com sucesso
     - ignorado por tipo de pedido
     - ignorado por evento não configurado
     - erro de envio

2. Criar uma migração no banco para suportar logs de tentativa/skip
   - Permitir log mesmo quando não existir um webhook “válido para envio”.
   - Adicionar campos operacionais para o motivo do não envio, por exemplo:
     - `dispatch_status`
     - `skip_reason`
   - Preservar as regras atuais de acesso.

3. Atualizar `src/hooks/useOrderWebhooks.ts`
   - Fazer a lista de `order_webhook_logs` atualizar em tempo real.
   - Refrescar a aba de logs automaticamente quando uma nova linha entrar.

4. Habilitar realtime para os logs no backend
   - Adicionar `order_webhook_logs` à publication de realtime para que a aba “Logs de Envio” reflita o evento na hora.

5. Melhorar `src/components/settings/WebhooksSettings.tsx`
   - Mostrar no card de cada webhook os tipos de pedido aceitos.
   - Destacar quando ele estiver limitado só a `Delivery`.
   - Exibir no log o motivo do bloqueio de forma legível, em vez de “sumir”.

6. Corrigir os defaults do frontend
   - Incluir `order.created` nas listas padrão de eventos.
   - Alinhar `src/hooks/useOrderWebhooks.ts` e `src/components/settings/WebhooksSettings.tsx`, porque hoje esse evento não está explícito nas opções padrão do frontend.
   - Manter “Todos os tipos de pedido” como configuração clara e consistente.

## Resultado esperado
- Assim que o pedido entrar, o sistema registrará algo no log imediatamente.
- Se enviar, aparecerá como enviado.
- Se não enviar por filtro, aparecerá como ignorado com motivo.
- A aba “Logs de Envio” passará a atualizar sem precisar recarregar.
- Novos webhooks não perderão o evento `order.created` por erro de configuração do frontend.

## Detalhes técnicos
```text
Hoje:
pedido chega
  -> listener chama order-webhooks
  -> order-webhooks filtra por tipo
  -> retorna cedo
  -> não grava log
  -> UI não atualiza em tempo real

Depois:
pedido chega
  -> listener chama order-webhooks
  -> edge function grava tentativa imediatamente
  -> decide: enviado | ignorado | erro
  -> log aparece na hora na tela
```

## Observação importante
Não vou remover silenciosamente filtros já configurados pelo usuário. O plano corrige o problema real: o sistema precisa registrar e mostrar imediatamente o que aconteceu com cada pedido, inclusive quando o envio foi bloqueado por configuração.
