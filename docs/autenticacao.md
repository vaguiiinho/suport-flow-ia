# Identidade e acesso

## Limites implementados

- O MVP resolve a organização padrão pelo slug configurado no servidor.
- Nenhum endpoint aceita `organizationId` como fonte de autorização.
- Atendentes possuem papel `ATTENDANT` e estado `ACTIVE` ou `DISABLED`.
- Clientes recebem uma sessão anônima vinculada no mesmo transaction boundary a uma conversa e à organização padrão.
- Sessões opacas são aleatórias; somente o hash SHA-256 do token é persistido.
- Eventos armazenam HMAC do e-mail normalizado e da identidade de rede, nunca os valores originais.

## Bootstrap do primeiro atendente

Defina temporariamente `BOOTSTRAP_ATTENDANT_EMAIL`, `BOOTSTRAP_ATTENDANT_PASSWORD` e `AUTH_SECURITY_PEPPER`, então execute:

```bash
npm run db:seed
```

O bootstrap exige senha entre 12 e 128 caracteres, usa `scrypt` com salt aleatório e só cria a conta quando a organização ainda não possui usuários. Execuções posteriores não alteram e-mail ou senha existentes. Remova as credenciais de bootstrap do ambiente depois da criação.

## Endpoints

| Método | Caminho                              | Proteção                        | Resultado                                   |
| ------ | ------------------------------------ | ------------------------------- | ------------------------------------------- |
| `POST` | `/api/v1/auth/login`                 | origem confiável e rate limit   | cookie de sessão, usuário, CSRF e expiração |
| `GET`  | `/api/v1/auth/session`               | sessão de atendente             | identidade e expiração                      |
| `GET`  | `/api/v1/auth/csrf`                  | sessão de atendente             | novo token CSRF                             |
| `POST` | `/api/v1/auth/logout`                | sessão, origem e `x-csrf-token` | revoga sessão e remove cookie               |
| `POST` | `/api/v1/anonymous-sessions`         | origem confiável                | cookie, conversa e expiração                |
| `GET`  | `/api/v1/anonymous-sessions/current` | sessão anônima                  | conversa vinculada                          |

Os cookies são `httpOnly`, `SameSite=Strict`, limitados a `/api/v1` e usam `Secure` quando `COOKIE_SECURE=true`. O token CSRF é devolvido no login ou pode ser rotacionado em `GET /auth/csrf`; mutações administrativas devem enviar `x-csrf-token` e aplicar `AttendantSessionGuard`, `CsrfGuard` e `TrustedOriginGuard`.

## Rate limit e respostas

Falhas de login são contadas no PostgreSQL por conta pseudonimizada e, com limite ampliado, por identidade de rede pseudonimizada. O bloqueio sobrevive a reinícios e múltiplas instâncias. Credencial inexistente, senha incorreta e conta desabilitada retornam a mesma resposta `401`; excesso de tentativas retorna `429`.

Sessão ausente, expirada, revogada, pertencente a usuário desabilitado ou organização inativa retorna `401`. CSRF ausente ou inválido e origem não confiável retornam `403`.

## Validação

```bash
npm test
npm run test:integration
AUTH_E2E_EMAIL=... AUTH_E2E_PASSWORD=... npm run test:e2e:auth --workspace @support-flow/api
```

A suíte de integração cria duas organizações para provar que credenciais e sessões permanecem no contexto resolvido no servidor. O smoke test HTTP valida acesso negado, origem, cookie, CSRF, logout e sessão anônima.
