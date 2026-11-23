/** User administration (admin only): create accounts, change role, activate/deactivate, reset password. */
import { h, icon, mount, pageHeader } from '../../core/dom.js';
import { session } from '../../core/session.js';
import { notify, handleError } from '../../core/notify.js';
import { LIMITS, ROLES } from '../../config/app-config.js';
import { field, input, select, runSubmit } from '../../shared/form.js';
import { confirmDialog } from '../../shared/dialog.js';
import { avatar } from '../../shared/avatar.js';
import { listUsers, createUser, updateUserAccess, sendPasswordReset } from './user.service.js';

const L = LIMITS.user;

function createForm(onCreated) {
  const controls = {
    displayName: input({ maxlength: L.displayName, autocomplete: 'off' }),
    username: input({ maxlength: L.usernameMax, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' }),
    email: input({ type: 'email', maxlength: L.email, autocomplete: 'off' }),
    role: select(ROLES, { value: 'viewer' }),
    password: input({ type: 'text', minlength: L.minPassword, maxlength: L.maxPassword, autocomplete: 'new-password' }),
  };
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('plus'), 'Crear usuario');
  const form = h(
    'form',
    { class: 'card form-grid', novalidate: true, 'aria-label': 'Nuevo usuario' },
    h('h2', { class: 'field--wide' }, 'Nuevo usuario'),
    field({ label: 'Nombre', name: 'displayName', control: controls.displayName, required: true }),
    field({ label: 'Nombre de usuario', name: 'username', control: controls.username, required: true, hint: 'Con este nombre ingresará. Ej.: maria.lopez' }),
    field({ label: 'Correo electrónico', name: 'email', control: controls.email, required: true, hint: 'Para recuperar la contraseña.' }),
    field({ label: 'Rol', name: 'role', control: controls.role, required: true, hint: 'Consulta: solo ve. Editor: registra y modifica. Administrador: todo.' }),
    field({ label: 'Contraseña temporal', name: 'password', control: controls.password, required: true, hint: `Mínimo ${L.minPassword} caracteres. Entréguela a la persona y pídale cambiarla.` }),
    h('div', { class: 'field--wide button-row' }, submit),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, c.value]));
    if (await runSubmit(form, submit, () => createUser(values), 'Creando…')) {
      notify.success('Usuario creado.');
      form.reset();
      onCreated();
    }
  });
  return form;
}

function userRow(user, reload) {
  const isSelf = user.uid === session.user.uid;
  const role = select(ROLES, { value: user.role, 'aria-label': `Rol de ${user.displayName}`, disabled: isSelf });
  const active = h('input', { type: 'checkbox', class: 'switch', checked: user.active === true, disabled: isSelf, 'aria-label': `Cuenta activa de ${user.displayName}` });

  async function apply(next) {
    role.disabled = true;
    active.disabled = true;
    try {
      await updateUserAccess(user.uid, next);
      notify.success('Acceso actualizado.');
    } catch (error) {
      handleError(error, 'update user');
    }
    reload();
  }

  role.addEventListener('change', () => apply({ role: role.value, active: active.checked }));
  active.addEventListener('change', async () => {
    if (!active.checked) {
      const confirmed = await confirmDialog({
        title: 'Desactivar cuenta',
        message: `${user.displayName} ya no podrá ingresar al inventario. ¿Continuar?`,
        confirmText: 'Desactivar',
        danger: true,
      });
      if (!confirmed) {
        active.checked = true;
        return;
      }
    }
    apply({ role: role.value, active: active.checked });
  });

  const reset = h('button', { type: 'button', class: 'btn btn-secondary btn-small' }, icon('key'), 'Restablecer contraseña');
  reset.addEventListener('click', async () => {
    reset.disabled = true;
    try {
      await sendPasswordReset(user.email);
      notify.success(`Se envió un correo a ${user.email} para cambiar la contraseña.`);
    } catch (error) {
      handleError(error, 'reset password');
    } finally {
      reset.disabled = false;
    }
  });

  return h(
    'tr',
    null,
    h(
      'td',
      { dataset: { label: 'Nombre' } },
      h('span', { class: 'person' }, avatar(user, { size: 32 }), h('span', null, user.displayName, isSelf ? h('small', { class: 'muted block' }, '(usted)') : null)),
    ),
    h('td', { dataset: { label: 'Usuario' } }, user.username ? `@${user.username}` : '—'),
    h('td', { dataset: { label: 'Correo' } }, user.email),
    h('td', { dataset: { label: 'Rol' } }, role),
    h('td', { dataset: { label: 'Activo' } }, active),
    h('td', { dataset: { label: 'Acciones' } }, reset),
  );
}

export async function render(container) {
  const tableBody = h('tbody');
  let disposed = false;

  async function reload() {
    try {
      const users = await listUsers();
      if (disposed) return;
      mount(tableBody, users.map((user) => userRow(user, reload)));
    } catch (error) {
      handleError(error, 'list users');
    }
  }

  mount(
    container,
    pageHeader('Usuarios'),
    createForm(reload),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Usuarios registrados'),
      h(
        'table',
        { class: 'table responsive-table' },
        h('thead', null, h('tr', null, ['Nombre', 'Usuario', 'Correo', 'Rol', 'Activo', 'Acciones'].map((t) => h('th', { scope: 'col' }, t)))),
        tableBody,
      ),
    ),
  );
  await reload();
  return () => {
    disposed = true;
  };
}
