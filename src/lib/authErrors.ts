export function getSignupErrorMessage(error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('already registered') || msg.includes('user already registered')) {
    return 'Este email já está cadastrado';
  }
  if (msg.includes('weak_password') || msg.includes('password should contain') || msg.includes('password is too weak')) {
    return 'Senha muito fraca. Use letras maiúsculas, minúsculas, números e caracteres especiais';
  }
  if (msg.includes('invalid email')) {
    return 'Email inválido';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email não confirmado. Verifique sua caixa de entrada';
  }

  return 'Erro ao criar conta. Tente novamente';
}

export function getLoginErrorMessage(error: Error): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Email ou senha incorretos';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email não confirmado. Verifique sua caixa de entrada';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos';
  }
  if (msg.includes('user not found')) {
    return 'Usuário não encontrado';
  }

  return error.message;
}
