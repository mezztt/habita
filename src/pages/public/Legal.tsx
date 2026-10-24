import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_BRAND, APP_NAME } from "../../config";
import { InstagramLink, MezzttLink, HabitaLogo, PoweredBy, useBrandLinks, useLightPage } from "../../components/Brand";

/**
 * Textos legales públicos (sin login): /legal/terminos y /legal/privacidad.
 * Son textos generales del servicio; no reemplazan el asesoramiento de un profesional (ver LEGAL.md).
 */
const UPDATED = "octubre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="lg-section"><h2>{title}</h2>{children}</section>;
}

function Contact() {
  const links = useBrandLinks();
  return (
    <p className="lg-contact">
      Escribinos por el Instagram de <MezzttLink />
      <InstagramLink href={links.mezztt_instagram_url} label={`Instagram de ${APP_BRAND}`} />
    </p>
  );
}

function Terminos() {
  return (
    <>
      <p className="lg-lead">
        Estas son las condiciones para usar {APP_NAME}. Están escritas en lenguaje simple. Si usás el sistema, entendemos que las aceptás.
      </p>
      <Section title="1. Qué es Habita">
        <p>{APP_NAME} es un sistema de gestión para inmobiliarias dedicadas al alquiler: propiedades, contratos, cobranza y recibos, liquidaciones a propietarios, garantías, expensas, reparaciones, inspecciones, documentos, interesados y visitas, según los módulos que cada inmobiliaria contrate. Puede incluir páginas públicas: catálogo de propiedades y portal del inquilino o propietario.</p>
      </Section>
      <Section title="2. Quién presta el servicio">
        <p>El servicio lo presta {APP_BRAND}, que desarrolla y mantiene el sistema. El cliente es la inmobiliaria que lo contrata, y es quien decide qué personas de su equipo tienen usuario y qué puede hacer cada una.</p>
      </Section>
      <Section title="3. Cuenta y contraseñas">
        <ul>
          <li>Cada usuario es personal. No compartas tu contraseña.</li>
          <li>El cliente es responsable de lo que se hace con los usuarios que crea y de darlos de baja cuando alguien deja de trabajar con él.</li>
          <li>Si creés que alguien entró con tu usuario, cambiá la contraseña y avisanos.</li>
        </ul>
      </Section>
      <Section title="4. Uso permitido">
        <ul>
          <li>El sistema es para la actividad comercial del cliente. No se puede usar para fines ilegales ni para cargar datos de personas sin tener derecho a hacerlo.</li>
          <li>No está permitido intentar entrar a datos de otros clientes, copiar el sistema ni afectar su funcionamiento.</li>
          <li>{APP_NAME} es una herramienta de registro y organización. Lo que se informa en los contratos, recibos, liquidaciones y publicaciones es responsabilidad de la inmobiliaria.</li>
        </ul>
      </Section>
      <Section title="5. Índices de ajuste">
        <p>{APP_NAME} calcula los ajustes de alquiler con los índices (IPC, ICL, CVS, UVA y otros) que carga {APP_BRAND} o la propia inmobiliaria. Se informan con su fuente y su fecha de carga, pero {APP_NAME} no garantiza que coincidan con la publicación oficial: antes de comunicar un ajuste, confirmalo. El ajuste siempre queda como propuesta hasta que la inmobiliaria lo confirma.</p>
      </Section>
      <Section title="6. Comprobantes y facturación">
        <ul>
          <li>{APP_NAME} <b>no emite</b> comprobantes fiscales de ARCA. Los recibos, liquidaciones y comprobantes que imprime son documentos internos: <b>Documento no válido como factura</b>.</li>
          <li>La facturación electrónica, los honorarios facturados y los impuestos son responsabilidad de la inmobiliaria y de su contador.</li>
        </ul>
      </Section>
      <Section title="7. Pagos con Mercado Pago">
        <p>Si la inmobiliaria conecta su cuenta de Mercado Pago para cobrar, el cobro se procesa en Mercado Pago, con las credenciales de la propia inmobiliaria. {APP_NAME} no guarda datos de tarjetas. Las comisiones, contracargos y devoluciones son una relación entre la inmobiliaria, quien paga y Mercado Pago.</p>
      </Section>
      <Section title="8. Abono y baja del servicio">
        <ul>
          <li>El servicio tiene un pago inicial y un abono mensual según los módulos contratados, acordados con {APP_BRAND} antes de empezar. Los módulos que dependen de otros incluyen lo necesario para funcionar, y eso se informa en la cotización.</li>
          <li>Podés pedir la baja cuando quieras, con el botón «Dar de baja el servicio» (en Configuración y en el menú; si no podés ingresar, también desde la pantalla de ingreso), sin motivo ni registro previo y con constancia inmediata. El sistema sigue funcionando hasta el final del período ya pagado, de acuerdo con la Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial (Ministerio de Economía) (que derogó la Resolución 424/2020 y la 316/2018). También podés ejercer el arrepentimiento dentro de los plazos legales.</li>
          <li>Si el abono queda impago, el acceso puede suspenderse después de avisarte. Los datos no se borran por eso.</li>
        </ul>
      </Section>
      <Section title="9. Tus datos son tuyos">
        <p>Los datos que el cliente carga en el sistema son del cliente (y de sus propietarios, inquilinos y empleados, según la ley). Podés pedirnos una copia en cualquier momento, también al darte de baja. Cómo los cuidamos está explicado en la <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
      </Section>
      <Section title="10. Disponibilidad">
        <p>Trabajamos para que el sistema esté disponible todo el tiempo y hacemos copias de seguridad, pero no podemos garantizar que nunca haya cortes: pueden existir interrupciones por mantenimiento, por fallas de internet o de los proveedores de alojamiento. Conviene tener un plan de respaldo para el servicio (por ejemplo, tener a mano los contratos y la lista de cobranzas) ante un corte.</p>
      </Section>
      <Section title="11. Responsabilidad">
        <p>{APP_BRAND} responde por el funcionamiento del sistema dentro de lo razonable. No responde por datos mal cargados, por decisiones comerciales o legales tomadas con esos datos, ni por el uso del sistema fuera de estas condiciones. La relación con propietarios, inquilinos, garantes y proveedores es de la inmobiliaria. {APP_NAME} no es una herramienta de asesoramiento legal.</p>
      </Section>
      <Section title="12. Cambios">
        <p>Podemos mejorar el sistema y actualizar estas condiciones. Si el cambio es importante, te avisamos antes.</p>
      </Section>
      <Section title="13. Ley aplicable">
        <p>Estas condiciones se rigen por las leyes de la República Argentina.</p>
      </Section>
      <Section title="14. Contacto"><Contact /></Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className="lg-lead">
        Acá te contamos qué datos personales se guardan en {APP_NAME}, para qué se usan y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.
      </p>
      <Section title="1. Quién es responsable de los datos">
        <ul>
          <li>La <b>inmobiliaria</b> que usa {APP_NAME} es el responsable de su base de datos: decide qué datos carga y para qué.</li>
          <li><b>{APP_BRAND}</b> presta el software y guarda esos datos por cuenta de la inmobiliaria. No los usa para otra cosa.</li>
        </ul>
      </Section>
      <Section title="2. Qué datos se guardan y para qué">
        <ul>
          <li><b>Propietarios, inquilinos y garantes:</b> nombre, documento, CUIT/CUIL, teléfono, email, domicilio y los datos del contrato y de los pagos. Sirven para administrar el alquiler, emitir recibos y liquidar a cada propietario.</li>
          <li><b>Interesados y visitas:</b> nombre, contacto, qué buscan y las visitas coordinadas.</li>
          <li><b>Empleados y usuarios:</b> nombre, email, rol y los datos necesarios para el acceso al sistema.</li>
          <li><b>Uso del sistema:</b> se registra quién hace acciones sensibles (cambios de contratos, cobros, liquidaciones) para cuidar la operación de la inmobiliaria.</li>
        </ul>
      </Section>
      <Section title="3. Datos de identidad y cumplimiento">
        <p>Para cumplir con las normas de prevención de lavado de activos, la inmobiliaria puede registrar documentación de identidad de las personas con las que opera. Se usa solo para ese fin y solo la ve quien tenga permiso dentro de la inmobiliaria.</p>
      </Section>
      <Section title="4. Si consultás por la web">
        <p>Te pedimos nombre y un contacto para responderte. Esos datos los recibe la inmobiliaria que elegiste, solo para atender tu consulta. {APP_NAME} no te pide ni guarda datos de tarjetas. Para ver tu portal usás un enlace con un código único, sin crear cuenta.</p>
      </Section>
      <Section title="5. No se venden ni se ceden">
        <p>Los datos no se venden, no se alquilan y no se entregan a terceros para publicidad. Solo se comparten cuando lo exige la ley o una orden judicial, o con los proveedores técnicos necesarios para que el sistema funcione (alojamiento y, si la inmobiliaria lo activa, Mercado Pago), que están obligados a mantener la confidencialidad. {APP_NAME} no envía mensajes por WhatsApp ni mails por su cuenta: los avisos a inquilinos y propietarios los hace la inmobiliaria.</p>
      </Section>
      <Section title="6. Tus derechos">
        <p>Podés pedir <b>acceso</b> a tus datos, que se <b>rectifiquen</b> o <b>actualicen</b> si están mal, y que se <b>supriman</b> cuando corresponda.</p>
        <p>El pedido se hace ante la inmobiliaria con la que operás, que es el responsable de la base. Si no sabés a quién dirigirte, escribinos y te orientamos.</p>
      </Section>
      <Section title="7. Seguridad">
        <p>Las contraseñas se guardan cifrados, la conexión es segura (https), cada cliente ve solo sus propios datos, las acciones sensibles quedan registradas y se hacen copias de seguridad. Ningún sistema es infalible: si detectamos un problema que afecte tus datos, se lo avisamos al responsable.</p>
      </Section>
      <Section title="8. Cookies y seguimiento">
        <p>{APP_NAME} no usa cookies de publicidad ni rastreadores de terceros. Solo guarda en tu navegador lo necesario para mantener tu sesión y tu preferencia de modo claro u oscuro.</p>
      </Section>
      <Section title="9. Órgano de control">
        <p className="lg-quote">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      </Section>
      <Section title="10. Contacto"><Contact /></Section>
    </>
  );
}

function Baja() {
  return (
    <>
      <p className="lg-lead">
        Podés dar de baja un servicio contratado a distancia o arrepentirte de la contratación, de forma simple y sin registrarte antes.
      </p>
      <Section title="1. Qué dice la norma">
        <p>La Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial (Ministerio de Economía) establece los botones de baja y de arrepentimiento para los servicios contratados por medios electrónicos. Derogó la Resolución 424/2020 y la Resolución 316/2018. Exige que el pedido pueda hacerse sin registro previo, que sea fácil de encontrar y que entregue de inmediato una constancia con fecha, hora y código.</p>
      </Section>
      <Section title="2. Cómo hacerlo en Habita">
        <ul>
          <li><b>Si sos cliente de Habita</b> (una inmobiliaria): en Configuración y en el menú está el botón «Dar de baja el servicio»: lo confirmás en dos pasos y recibís al instante una constancia BAJA-SRV-AAAA-NNNN. El sistema sigue funcionando hasta el final del período ya pagado, no se hacen cobros nuevos, tus datos se conservan y podés retirar la baja antes de esa fecha. Si no podés ingresar, usá el botón de la pantalla de ingreso.</li>
          <li><b>Si sos inquilino o propietario</b> de una inmobiliaria que usa Habita: en las páginas públicas de la inmobiliaria (catálogo y portal) están los botones de baja y arrepentimiento. Dejás tu nombre y un contacto y recibís una constancia con fecha, hora y código.</li>
        </ul>
      </Section>
      <Section title="3. Qué pasa después">
        <p>El pedido queda registrado con su código y se avisa a quien presta el servicio, que te responde por el contacto que dejaste. Tus datos son tuyos: podés pedir una copia antes de la baja.</p>
      </Section>
      <Section title="4. Contacto"><Contact /></Section>
    </>
  );
}

const DOCS = {
  terminos: { title: "Términos y condiciones", other: "privacidad", otherLabel: "Política de privacidad", Body: Terminos },
  privacidad: { title: "Política de privacidad", other: "baja", otherLabel: "Baja y arrepentimiento", Body: Privacidad },
  baja: { title: "Baja y arrepentimiento", other: "terminos", otherLabel: "Términos y condiciones", Body: Baja },
} as const;

function Legal({ doc }: { doc: keyof typeof DOCS }) {
  useLightPage();
  const d = DOCS[doc];
  useEffect(() => { document.title = `${d.title} · ${APP_NAME}`; window.scrollTo(0, 0); }, [d.title]);
  return (
    <div className="pb-page lg-page">
      <header className="lg-top">
        <div className="lg-wrap lg-top-row">
          <span className="lg-brand"><HabitaLogo size={34} /><strong>{APP_NAME}</strong></span>
          <button type="button" className="lg-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}>‹ Volver</button>
        </div>
      </header>
      <main className="lg-wrap">
        <article className="pb-card lg-card">
          <span className="pb-step-label">Legales</span>
          <h1>{d.title}</h1>
          <p className="lg-updated">Última actualización: {UPDATED}</p>
          <d.Body />
          <p className="lg-also">Leé también: <Link to={`/legal/${d.other}`}>{d.otherLabel}</Link></p>
        </article>
      </main>
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}

export default Legal;
