import type { ProductConfig } from './types'

export function getInitialMessages(product: ProductConfig): string[] {
  if (product.type === 'roblox-usd') {
    return [
      `Hola, ¡muchas gracias por tu compra! 😊\nTe voy a compartir las indicaciones para canjear tu Gift Card.`,
      `La Gift Card que adquiriste se activa en 2 pasos:\n1️⃣ Primero vas a canjear el código por ${product.amount} en tu cuenta de Roblox.\n(no aparecen automáticamente los Robux, sino los ${product.amount})\n2️⃣ Luego, con esos ${product.amount} podés comprar Robux o suscribirte a Premium.`,
      `🔑 ¿CÓMO CANJEAR?\n1️⃣ Ingresá a\nwww.roblox.com/redeem\n(desde un navegador web, NO desde la app)\n2️⃣ Iniciá sesión con el usuario donde querés cargar los Robux.`,
      `Cuando estés logueado en la cuenta correcta, avisame por acá y te envío el código de tu Gift Card. 😊`
    ]
  }

  if (product.type === 'roblox-robux') {
    return [
      `Hola, ¡muchas gracias por tu compra! 😊\nTe voy a compartir las indicaciones para canjear tu Gift Card de ${product.amount}.`,
      `🔑 ¿CÓMO CANJEAR TU TARJETA?\n\n1️⃣ Ingresá a:\nwww.roblox.com/redeem\n\n2️⃣ Iniciá sesión con el usuario donde querés cargar los Robux.\n\n⚠️ Recomendamos hacerlo desde un navegador web (Chrome, Edge, etc.), no desde la app.\n\nCuando estés listo para recibir el código avisame por acá. 👍`
    ]
  }

  // Steam
  return [
    `Hola, ¡muchas gracias por tu compra! 😊\nTe voy a compartir las indicaciones para canjear tu Gift Card de Steam.`,
    `🔑 ¿CÓMO CANJEAR TU TARJETA DE STEAM?\n\n1️⃣ Ingresá a:\nhttps://store.steampowered.com/account/redeemwalletcode\n\n2️⃣ Iniciá sesión en tu cuenta de Steam.\n\n⚠️ Recomendamos hacerlo desde un navegador web (Chrome, Edge, etc.), no desde la app, para evitar errores.\n\nCuando estés listo para recibir el código avisame por acá. 👍`
  ]
}

export function getCodeDeliveryMessage(product: ProductConfig, code: string): string[] {
  if (product.type === 'roblox-usd') {
    return [
      `Perfecto 👍\nTe comparto tu Gift Card.\n\n🎁 CÓDIGO:\n${code}\n\nIngresalo en:\nwww.roblox.com/redeem\n\nCuando lo ingreses se acreditarán ${product.amount} en tu cuenta.`,
      `Con esos ${product.amount} ahora podés elegir:\n1️⃣ Comprar 500 Robux directamente\no\n2️⃣ Suscribirte a Roblox Premium (450 Robux)\n\nRespondé 1 o 2 y te paso las indicaciones.`
    ]
  }

  if (product.type === 'roblox-robux') {
    return [
      `Perfecto 👍\nTe comparto tu Gift Card.\n\n🎁 CÓDIGO:\n${code}\n\nIngresalo en:\nwww.roblox.com/redeem\n\nUna vez ingresado se acreditarán ${product.amount} automáticamente en tu cuenta. 🎮`
    ]
  }

  // Steam
  return [
    `Perfecto 👍\nTe comparto tu Gift Card.\n\n🎁 CÓDIGO:\n${code}\n\nIngresalo en:\nhttps://store.steampowered.com/account/redeemwalletcode\n\nUna vez ingresado, el saldo se acreditará automáticamente en tu billetera de Steam.`
  ]
}

export function getOption1Message(): string {
  return `Perfecto 👍\nPara comprar 500 Robux:\n1️⃣ Ingresá a\nhttps://www.roblox.com/es/upgrades/robux\n2️⃣ Elegí el paquete de 500 Robux por USD 4.99\n3️⃣ En método de pago seleccioná\n✔ Pagar con crédito de Roblox\n\n❗ No hace falta ingresar nuevamente el código, porque el saldo ya quedó cargado en tu cuenta cuando lo canjeaste.`
}

export function getOption2Message(): string {
  return `Perfecto 👍\nPara contratar Roblox Premium:\n1️⃣ Ingresá a\nhttps://www.roblox.com/premium/membership\n2️⃣ Elegí el plan de USD 4.99\n3️⃣ En método de pago seleccioná\n✔ Pagar con crédito de Roblox\n\n❗ No hace falta ingresar nuevamente el código, porque el saldo ya quedó cargado en tu cuenta cuando lo canjeaste.\nRecibirás 450 Robux.`
}

export function getFinalMessage(): string {
  return `❗Ya tenés tu Gift Card Digital! Que la disfrutes!\n\nTe pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando.\n\nQuedamos a tu disposición! 🤝\nSomos Roblox_Argentina_ok\n\n❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos:\n1138201597 📱`
}

export function getFollowUpMessage(): string {
  return `¡Muchas gracias por tu compra! Si tienes alguna duda, un asesor te atenderá en breve. 😊`
}

export function getNoStockMessage(product: ProductConfig): string {
  return `Hola, ¡muchas gracias por tu compra! 😊\n\nEn unos momentos un asesor se comunicará para entregarte la gift card de ${product.displayName}.\n\nDisculpá las molestias y gracias por tu paciencia.`
}
