# Regras de Hooks - Padrões do Projeto

Este documento descreve as regras obrigatórias para uso de React Hooks neste projeto.

## Regra Principal: Hooks SEMPRE Primeiro

Todos os hooks devem ser chamados **antes** de qualquer return condicional no componente.

## ❌ INCORRETO - Hooks após return condicional

```tsx
function Component() {
  const { hasPermission, isLoading } = useUserPermissions();
  
  // ❌ ERRO: Return antes de todos os hooks serem chamados
  if (!isLoading && !hasPermission('view')) {
    return <AccessDenied />;
  }
  
  // ❌ Estes hooks não serão chamados se retornar antes
  const [state, setState] = useState('');
  const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
  
  return <MainContent data={data} />;
}
```

**Problema:** React espera que hooks sejam chamados na mesma ordem em todos os renders. Se um componente retorna antes de chamar todos os hooks, o número de hooks muda entre renders, causando o erro:

> "Rendered more hooks than during the previous render"

## ✅ CORRETO - Todos os hooks primeiro

```tsx
function Component() {
  // ✅ TODOS os hooks são chamados PRIMEIRO, incondicionalmente
  const { hasPermission, isLoading } = useUserPermissions();
  const [state, setState] = useState('');
  const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
  
  // ✅ Return condicional DEPOIS de todos os hooks
  if (!isLoading && !hasPermission('view')) {
    return <AccessDenied />;
  }
  
  return <MainContent data={data} />;
}
```

## Padrão Recomendado para Componentes com Permissões

```tsx
export default function MyPage() {
  // 1️⃣ Hooks de autenticação/permissões
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  
  // 2️⃣ Hooks de estado local (useState)
  const [filter, setFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  // 3️⃣ Hooks de dados (useQuery, custom hooks)
  const { data, isLoading } = useMyData();
  
  // 4️⃣ Hooks de efeitos (useEffect)
  useEffect(() => {
    // efeitos aqui
  }, []);
  
  // 5️⃣ Hooks de memoização (useMemo, useCallback)
  const processedData = useMemo(() => {
    return data?.filter(item => item.name.includes(filter));
  }, [data, filter]);
  
  // 6️⃣ Variáveis derivadas de permissões
  const canView = hasPermission('view');
  const canEdit = hasPermission('edit');
  
  // 7️⃣ Returns condicionais (DEPOIS de todos os hooks)
  if (!permissionsLoading && !canView) {
    return <AccessDenied permission="view" />;
  }
  
  // 8️⃣ Return principal
  return (
    <Layout>
      <Content data={processedData} />
    </Layout>
  );
}
```

## Checklist de Revisão de Código

Antes de fazer commit, verifique:

- [ ] Todos os `useState` estão no início do componente?
- [ ] Todos os `useEffect` estão antes de returns condicionais?
- [ ] Todos os `useMemo` e `useCallback` estão antes de returns condicionais?
- [ ] Todos os custom hooks estão antes de returns condicionais?
- [ ] Todos os `useQuery` / `useMutation` estão antes de returns condicionais?

## ESLint

O projeto está configurado com `eslint-plugin-react-hooks` para detectar violações:

```javascript
// eslint.config.js
rules: {
  "react-hooks/rules-of-hooks": "error",    // Erro fatal
  "react-hooks/exhaustive-deps": "warn",    // Warning para deps
}
```

## Pre-commit Hook Automático

Este projeto usa **husky** + **lint-staged** para verificar automaticamente as regras de hooks antes de cada commit.

### O que acontece no commit?

1. `git commit` dispara o hook pre-commit
2. lint-staged executa ESLint apenas nos arquivos staged (.ts/.tsx)
3. Se houver violações de hooks, o commit é **bloqueado**
4. Você deve corrigir os erros antes de fazer commit

### Configuração

O projeto inclui:
- `.husky/pre-commit` - Hook que executa lint-staged
- `.lintstagedrc.json` - Configuração do lint-staged

### Bypass (não recomendado)

Em casos extremos, você pode pular a verificação:

```bash
git commit --no-verify -m "mensagem"
```

⚠️ Isso **NÃO é recomendado** e deve ser evitado.

## Referências

- [Rules of Hooks - React Docs](https://react.dev/reference/rules/rules-of-hooks)
- [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)
- [Husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/lint-staged/lint-staged)
