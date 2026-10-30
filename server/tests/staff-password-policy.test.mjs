import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateStaffPassword, isStrongStaffPassword } from '../../src/utils/staffPassword.js'

test('contraseñas asignadas rechazan valores débiles, controles y truncamiento de bcrypt', () => {
  for (const value of ['', 'ADMIN1234', 'solo-minusculas-largas', '11111111111111111', ' Aa1!abcdefghijk', 'Aa1!abcdefghijk\n', 'Aa1!' + 'ñ'.repeat(35)]) assert.equal(isStrongStaffPassword(value), false)
  for (const value of ['Aa1!abcdefghijk', 'FelizRuta2026Casa', 'A7!' + 'x'.repeat(69)]) assert.equal(isStrongStaffPassword(value), true)
})
test('el generador usa aleatoriedad criptográfica y produce claves distintas que cumplen la política', () => {
  const generated = new Set(Array.from({ length: 100 }, () => generateStaffPassword()))
  assert.equal(generated.size, 100)
  for (const value of generated) { assert.equal(value.length, 24); assert.equal(isStrongStaffPassword(value), true) }
})
