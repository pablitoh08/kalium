import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Bug,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Paperclip,
  Upload,
  X,
  ChevronDown,
  Settings,
  Pencil,
  Trash2,
  FileText,
  Images,
  Info,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

/**
 * Kalium Network — Sistema de Gestión de Incidencias (frontend-only)
 * ---------------------------------------------------------------
 * ✅ Características clave:
 *  - Crear incidencias con prioridad, categoría, servidor y adjuntos (imágenes/archivos)
 *  - Listado con búsqueda, filtros y ordenación
 *  - Vista/edición de detalle y cambio de estado
 *  - Contenido personalizado (bloques Markdown) para la web
 *  - Persistencia en localStorage (sustituible por API)
 *  - UI moderna con Tailwind + shadcn/ui + lucide-react + framer-motion
 *
 * 🔌 Integración backend:
 *  Reemplaza las funciones fetch*() por llamadas a tu API. Marcado TODO donde corresponde.
 */

// -----------------------------
// Utilidades y tipos
// -----------------------------
const LS_KEYS = {
  incidents: "kalium_incidents",
  contentBlocks: "kalium_content_blocks",
  settings: "kalium_settings",
};

const DEFAULT_SETTINGS = {
  categories: ["General", "Errores de conexión", "Economía", "Reportes de jugadores", "Sugerencias"],
  servers: ["Lobby", "Survival", "Skyblock", "Minijuegos"],
  priorities: ["Baja", "Media", "Alta", "Crítica"],
};

const STATUS_OPTIONS = ["Abierta", "En progreso", "Resuelta", "Cerrada"] as const;

type Status = typeof STATUS_OPTIONS[number];

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string; // ObjectURL (frontend) o URL devuelta por backend
};

type Incident = {
  id: string;
  title: string;
  description: string;
  category: string;
  server: string;
  priority: string;
  status: Status;
  reporter?: { email?: string; discord?: string };
  attachments: Attachment[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

type ContentBlock = {
  id: string;
  title: string;
  body: string; // Markdown
  updatedAt: string;
};

// -----------------------------
// Helpers
// -----------------------------
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function saveLS<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

// -----------------------------
// Componente principal
// -----------------------------
export default function KaliumIncidentsApp() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>(() => loadLS(LS_KEYS.incidents, []));
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(() => loadLS(LS_KEYS.contentBlocks, []));
  const [settings, setSettings] = useState(() => loadLS(LS_KEYS.settings, DEFAULT_SETTINGS));

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "Todos">("Todos");
  const [priorityFilter, setPriorityFilter] = useState<string | "Todas">("Todas");
  const [sortBy, setSortBy] = useState<"fecha" | "prioridad">("fecha");
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);

  useEffect(() => saveLS(LS_KEYS.incidents, incidents), [incidents]);
  useEffect(() => saveLS(LS_KEYS.contentBlocks, contentBlocks), [contentBlocks]);
  useEffect(() => saveLS(LS_KEYS.settings, settings), [settings]);

  // ----------------------
  // CRUD Incidencias (mock)
  // ----------------------
  function createIncident(data: Omit<Incident, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const n: Incident = { id: uid("inc"), createdAt: now, updatedAt: now, ...data };
    setIncidents((prev) => [n, ...prev]);
    toast({ title: "Incidencia creada", description: n.title });
  }

  function updateIncident(id: string, patch: Partial<Incident>) {
    setIncidents((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it))
    );
  }

  function deleteIncident(id: string) {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
  }

  // ----------------------
  // CRUD Contenido (mock)
  // ----------------------
  function upsertBlock(block?: Partial<ContentBlock>) {
    if (!block?.id) {
      const b: ContentBlock = {
        id: uid("blk"),
        title: block?.title || "Nuevo bloque",
        body: block?.body || "Escribe contenido en **Markdown**.",
        updatedAt: new Date().toISOString(),
      };
      setContentBlocks((p) => [b, ...p]);
      return;
    }
    setContentBlocks((p) => p.map((x) => (x.id === block.id ? { ...x, ...block, updatedAt: new Date().toISOString() } : x)));
  }

  function deleteBlock(id: string) {
    setContentBlocks((p) => p.filter((x) => x.id !== id));
  }

  // ----------------------
  // Derivados UI
  // ----------------------
  const filtered = useMemo(() => {
    let list = [...incidents];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) =>
        [i.title, i.description, i.category, i.server, i.priority, i.status, i.reporter?.discord, i.reporter?.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "Todos") list = list.filter((i) => i.status === statusFilter);
    if (priorityFilter !== "Todas") list = list.filter((i) => i.priority === priorityFilter);

    if (sortBy === "fecha") list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else {
      const rank = (p: string) => settings.priorities.indexOf(p);
      list.sort((a, b) => rank(b.priority) - rank(a.priority));
    }
    return list;
  }, [incidents, query, statusFilter, priorityFilter, sortBy, settings.priorities]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 backdrop-blur border-b border-white/10 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bug className="h-7 w-7 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight">Kalium Network · Incidencias</h1>
          </div>
          <div className="flex items-center gap-2">
            <SettingsDialog settings={settings} setSettings={setSettings} />
            <a
              href="https://discord.com" target="_blank" rel="noreferrer"
              className="text-sm opacity-80 hover:opacity-100 inline-flex items-center gap-1"
            >
              Soporte en Discord <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="portal">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="portal">Portal</TabsTrigger>
            <TabsTrigger value="incidencias">Incidencias</TabsTrigger>
            <TabsTrigger value="contenido">Contenido</TabsTrigger>
          </TabsList>

          {/* PORTAL */}
          <TabsContent value="portal" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle>Crear una incidencia</CardTitle>
                  <CardDescription>Describe tu problema o sugerencia y adjunta capturas o archivos.</CardDescription>
                </CardHeader>
                <CardContent>
                  <IncidentForm
                    settings={settings}
                    onSubmit={(payload) =>
                      createIncident({ ...payload, status: "Abierta" })
                    }
                  />
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle>Estado rápido</CardTitle>
                  <CardDescription>Resumen de incidencias por estado y prioridad.</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuickStats incidents={incidents} />
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid gap-6">
              <Card className="bg-slate-900/60 border-white/10">
                <CardHeader>
                  <CardTitle>Últimas incidencias</CardTitle>
                  <CardDescription>Las 8 más recientes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <IncidentTable
                    data={incidents.slice(0, 8)}
                    onOpen={(i) => setActiveIncident(i)}
                    onDelete={(id) => deleteIncident(id)}
                    onStatusChange={(id, status) => updateIncident(id, { status })}
                  />
                </CardContent>
              </Card>

              <HomeContent contentBlocks={contentBlocks} />
            </div>
          </TabsContent>

          {/* INCIDENCIAS */}
          <TabsContent value="incidencias" className="mt-6">
            <Card className="bg-slate-900/60 border-white/10">
              <CardHeader className="gap-2">
                <CardTitle>Gestión de incidencias</CardTitle>
                <div className="grid md:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2 top-2.5 opacity-60" />
                      <Input
                        placeholder="Buscar por título, descripción, servidor, etc."
                        className="pl-8 bg-slate-950/50"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="bg-slate-950/50"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v)}>
                      <SelectTrigger className="bg-slate-950/50"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todas">Todas</SelectItem>
                        {settings.priorities.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="bg-slate-950/50 w-[140px]"><SelectValue placeholder="Orden" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fecha">Más recientes</SelectItem>
                        <SelectItem value="prioridad">Por prioridad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <IncidentTable
                  data={filtered}
                  onOpen={(i) => setActiveIncident(i)}
                  onDelete={(id) => deleteIncident(id)}
                  onStatusChange={(id, status) => updateIncident(id, { status })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTENIDO */}
          <TabsContent value="contenido" className="mt-6">
            <ContentManager
              blocks={contentBlocks}
              onCreate={() => upsertBlock({})}
              onUpdate={(b) => upsertBlock(b)}
              onDelete={(id) => deleteBlock(id)}
            />
          </TabsContent>
        </Tabs>
      </main>

      <IncidentDialog
        incident={activeIncident}
        onClose={() => setActiveIncident(null)}
        onUpdate={(patch) => activeIncident && updateIncident(activeIncident.id, patch)}
        onDelete={() => {
          if (!activeIncident) return;
          deleteIncident(activeIncident.id);
          setActiveIncident(null);
        }}
      />
    </div>
  );
}

// -----------------------------
// Componentes auxiliares
// -----------------------------
function QuickStats({ incidents }: { incidents: Incident[] }) {
  const byStatus = useMemo(() =>
    STATUS_OPTIONS.map((s) => ({
      status: s,
      count: incidents.filter((i) => i.status === s).length,
    })), [incidents]
  );

  const critical = incidents.filter((i) => i.priority === "Crítica").length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {byStatus.map(({ status, count }) => (
        <motion.div key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/10">
            <div className="flex items-center gap-2 text-sm opacity-80 mb-1">
              {status === "Abierta" && <AlertTriangle className="h-4 w-4" />}
              {status === "En progreso" && <Clock className="h-4 w-4" />}
              {status === "Resuelta" && <CheckCircle2 className="h-4 w-4" />}
              {status === "Cerrada" && <Bug className="h-4 w-4" />}
              <span>{status}</span>
            </div>
            <div className="text-2xl font-bold">{count}</div>
          </div>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="p-4 rounded-2xl bg-rose-900/30 border border-rose-500/30">
          <div className="flex items-center gap-2 text-sm opacity-90 mb-1"><AlertTriangle className="h-4 w-4" />Críticas</div>
          <div className="text-2xl font-bold">{critical}</div>
        </div>
      </motion.div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    Abierta: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    "En progreso": "bg-sky-500/10 text-sky-300 border-sky-500/30",
    Resuelta: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    Cerrada: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  };
  return <Badge className={`border ${map[status]} rounded-full px-3`}>{status}</Badge>;
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    Baja: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    Media: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    Alta: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    Crítica: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  };
  return <Badge className={`border ${map[p] || ""} rounded-full px-3`}>{p}</Badge>;
}

function IncidentTable({
  data,
  onOpen,
  onDelete,
  onStatusChange,
}: {
  data: Incident[];
  onOpen: (inc: Incident) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Status) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-300/80">
          <tr className="border-b border-white/10">
            <th className="py-2 pr-2">Título</th>
            <th className="py-2 pr-2">Servidor</th>
            <th className="py-2 pr-2">Categoría</th>
            <th className="py-2 pr-2">Prioridad</th>
            <th className="py-2 pr-2">Estado</th>
            <th className="py-2 pr-2">Creada</th>
            <th className="py-2 pr-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-10 opacity-70">Sin resultados.</td>
            </tr>
          )}
          {data.map((i) => (
            <tr key={i.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 pr-2 font-medium">
                <button className="hover:underline" onClick={() => onOpen(i)}>{i.title}</button>
              </td>
              <td className="py-2 pr-2">{i.server}</td>
              <td className="py-2 pr-2">{i.category}</td>
              <td className="py-2 pr-2"><PriorityBadge p={i.priority} /></td>
              <td className="py-2 pr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-7 px-3 bg-transparent border-white/10">
                      <span className="mr-1">{i.status}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    {STATUS_OPTIONS.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => onStatusChange(i.id, s)}>{s}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
              <td className="py-2 pr-2 whitespace-nowrap">{formatDate(i.createdAt)}</td>
              <td className="py-2 pr-2 text-right">
                <div className="inline-flex gap-2">
                  <Button size="sm" variant="outline" className="bg-transparent border-white/10" onClick={() => onOpen(i)}>
                    <FileText className="h-4 w-4 mr-1" /> Ver
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onDelete(i.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Borrar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncidentForm({
  settings,
  onSubmit,
  initial,
}: {
  settings: typeof DEFAULT_SETTINGS;
  onSubmit: (payload: Omit<Incident, "id" | "createdAt" | "updatedAt" | "status"> & { status?: Status }) => void;
  initial?: Partial<Incident>;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || settings.categories[0]);
  const [server, setServer] = useState(initial?.server || settings.servers[0]);
  const [priority, setPriority] = useState(initial?.priority || settings.priorities[1]);
  const [email, setEmail] = useState(initial?.reporter?.email || "");
  const [discord, setDiscord] = useState(initial?.reporter?.discord || "");
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments || []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const added: Attachment[] = Array.from(files).map((f) => ({
      id: uid("att"),
      name: f.name,
      type: f.type,
      size: f.size,
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...added, ...prev]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      server,
      priority,
      attachments,
      reporter: { email: email.trim() || undefined, discord: discord.trim() || undefined },
      status: "Abierta",
    });
    setTitle("");
    setDescription("");
    setEmail("");
    setDiscord("");
    setAttachments([]);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumen claro y conciso" className="bg-slate-950/50" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Servidor</Label>
            <Select value={server} onValueChange={setServer}>
              <SelectTrigger className="bg-slate-950/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.servers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-slate-950/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-slate-950/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <Label>Descripción</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="bg-slate-950/50" placeholder="Pasos, comportamiento esperado y real, mensajes de error, etc." />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Email (opcional)</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tu@email.com" className="bg-slate-950/50" />
        </div>
        <div>
          <Label>Discord (opcional)</Label>
          <Input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="TuUsuario#0000" className="bg-slate-950/50" />
        </div>
      </div>

      <div>
        <Label>Adjuntos</Label>
        <div className="flex items-center gap-3 mt-1">
          <Input ref={fileInputRef} type="file" multiple onChange={(e) => handleFiles(e.target.files)} className="bg-slate-950/50" />
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Subir archivos
          </Button>
        </div>
        {attachments.length > 0 && (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attachments.map((a) => (
              <div key={a.id} className="p-3 rounded-xl border border-white/10 bg-slate-950/50 flex items-center gap-3">
                <Paperclip className="h-4 w-4" />
                <div className="text-sm truncate">
                  <div className="truncate font-medium">{a.name}</div>
                  <div className="opacity-60 text-xs">{(a.size / 1024).toFixed(1)} KB</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {a.type.startsWith("image/") && (
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-xs underline">Ver</a>
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAttachment(a.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs opacity-70 mt-2 flex items-center gap-1"><Info className="h-3 w-3" /> En esta demo los adjuntos se guardan como URLs temporales en tu navegador. En producción, súbelos a tu servidor o almacenamiento (S3, etc.) y guarda la URL devuelta por la API.</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs opacity-70">Al enviar aceptas las normas de la comunidad.</p>
        <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Crear incidencia</Button>
      </div>
    </form>
  );
}

function IncidentDialog({
  incident,
  onClose,
  onUpdate,
  onDelete,
}: {
  incident: Incident | null;
  onClose: () => void;
  onUpdate: (patch: Partial<Incident>) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState("detalle");
  if (!incident) return null;
  return (
    <Dialog open={!!incident} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-emerald-400" /> {incident.title}
          </DialogTitle>
          <DialogDescription>Creada el {formatDate(incident.createdAt)} · Última actualización {formatDate(incident.updatedAt)}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
            <TabsTrigger value="editar">Editar</TabsTrigger>
          </TabsList>
          <TabsContent value="detalle" className="mt-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2 p-3 rounded-xl border border-white/10 bg-slate-950/50">
                <h4 className="font-semibold mb-2">Descripción</h4>
                <p className="whitespace-pre-wrap leading-relaxed opacity-90">{incident.description}</p>
              </div>
              <div className="p-3 rounded-xl border border-white/10 bg-slate-950/50 space-y-2 text-sm">
                <div><span className="opacity-70">Estado: </span><StatusBadge status={incident.status} /></div>
                <div><span className="opacity-70">Prioridad: </span><PriorityBadge p={incident.priority} /></div>
                <div><span className="opacity-70">Categoría: </span>{incident.category}</div>
                <div><span className="opacity-70">Servidor: </span>{incident.server}</div>
                {incident.reporter?.email && <div><span className="opacity-70">Email: </span>{incident.reporter.email}</div>}
                {incident.reporter?.discord && <div><span className="opacity-70">Discord: </span>{incident.reporter.discord}</div>}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="adjuntos" className="mt-3">
            {incident.attachments.length === 0 ? (
              <div className="text-sm opacity-70">No hay adjuntos.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {incident.attachments.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl border border-white/10 bg-slate-950/50">
                    <div className="text-sm font-medium truncate mb-1">{a.name}</div>
                    {a.type.startsWith("image/") ? (
                      <img src={a.url} alt={a.name} className="rounded-lg w-full h-48 object-cover" />
                    ) : (
                      <div className="text-xs opacity-70">Archivo: {a.type || "(desconocido)"}</div>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="opacity-70">{(a.size / 1024).toFixed(1)} KB</span>
                      <a href={a.url} target="_blank" rel="noreferrer" className="underline">Abrir</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="editar" className="mt-3">
            <EditIncidentForm incident={incident} onUpdate={onUpdate} />
            <div className="flex items-center justify-end mt-4">
              <Button variant="destructive" onClick={onDelete} className="gap-2"><Trash2 className="h-4 w-4" /> Borrar incidencia</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EditIncidentForm({ incident, onUpdate }: { incident: Incident; onUpdate: (patch: Partial<Incident>) => void }) {
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description);
  const [status, setStatus] = useState<Status>(incident.status);
  return (
    <div className="space-y-3">
      <div>
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-slate-950/50" />
      </div>
      <div>
        <Label>Descripción</Label>
        <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-950/50" />
      </div>
      <div>
        <Label>Estado</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="bg-slate-950/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-end">
        <Button onClick={() => onUpdate({ title, description, status })} className="gap-2"><Pencil className="h-4 w-4" /> Guardar cambios</Button>
      </div>
    </div>
  );
}

function SettingsDialog({ settings, setSettings }: { settings: typeof DEFAULT_SETTINGS; setSettings: React.Dispatch<React.SetStateAction<typeof DEFAULT_SETTINGS>> }) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState(settings.categories.join(", "));
  const [srvs, setSrvs] = useState(settings.servers.join(", "));
  const [pris, setPris] = useState(settings.priorities.join(", "));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-transparent border-white/10 gap-2"><Settings className="h-4 w-4" /> Configuración</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
          <DialogDescription>Define categorías, servidores y prioridades disponibles.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Categorías (separadas por coma)</Label>
            <Input value={cats} onChange={(e) => setCats(e.target.value)} />
          </div>
          <div>
            <Label>Servidores (separados por coma)</Label>
            <Input value={srvs} onChange={(e) => setSrvs(e.target.value)} />
          </div>
          <div>
            <Label>Prioridades (baja → crítica en orden)</Label>
            <Input value={pris} onChange={(e) => setPris(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            setSettings({
              categories: cats.split(",").map((s) => s.trim()).filter(Boolean),
              servers: srvs.split(",").map((s) => s.trim()).filter(Boolean),
              priorities: pris.split(",").map((s) => s.trim()).filter(Boolean),
            });
            setOpen(false);
          }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContentManager({
  blocks,
  onCreate,
  onUpdate,
  onDelete,
}: {
  blocks: ContentBlock[];
  onCreate: () => void;
  onUpdate: (b: Partial<ContentBlock>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<ContentBlock | null>(null);
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Bloques de contenido</h3>
          <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" /> Nuevo bloque</Button>
        </div>
        {blocks.length === 0 && <div className="opacity-70 text-sm">Aún no hay contenido. Crea el primero.</div>}
        {blocks.map((b) => (
          <div key={b.id} className="p-4 rounded-2xl bg-slate-950/50 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{b.title}</div>
                <div className="text-xs opacity-60">Actualizado {formatDate(b.updatedAt)}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="bg-transparent border-white/10" onClick={() => setEditing(b)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                <Button variant="destructive" onClick={() => onDelete(b.id)}><Trash2 className="h-4 w-4 mr-1" /> Borrar</Button>
              </div>
            </div>
            <div className="prose prose-invert max-w-none mt-3">
              <ReactMarkdown>{b.body}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Card className="bg-slate-900/60 border-white/10">
          <CardHeader>
            <CardTitle>Consejos</CardTitle>
            <CardDescription>Usa bloques para noticias, normas, FAQs, changelogs, etc.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm opacity-90 space-y-2">
            <p>Los bloques aceptan <strong>Markdown</strong>. Puedes poner enlaces, listas, títulos y más.</p>
            <p>Ejemplos de uso:
              <ul className="list-disc ml-5">
                <li>Anuncios de mantenimiento</li>
                <li>Guías de juego y reglas</li>
                <li>Registro de cambios (changelogs)</li>
              </ul>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-white/10">
          <CardHeader>
            <CardTitle>Vista previa en portada</CardTitle>
            <CardDescription>Así se mostrarán en el Portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <HomeContent contentBlocks={blocks} compact />
          </CardContent>
        </Card>
      </div>

      <EditBlockDialog block={editing} onClose={() => setEditing(null)} onSave={(b) => { onUpdate(b); setEditing(null); }} />
    </div>
  );
}

function EditBlockDialog({ block, onClose, onSave }: { block: ContentBlock | null; onClose: () => void; onSave: (b: Partial<ContentBlock>) => void }) {
  const [title, setTitle] = useState(block?.title || "");
  const [body, setBody] = useState(block?.body || "");
  useEffect(() => { setTitle(block?.title || ""); setBody(block?.body || ""); }, [block]);
  if (!block) return null;
  return (
    <Dialog open={!!block} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar bloque</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Contenido (Markdown)</Label>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onSave({ id: block.id, title, body })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HomeContent({ contentBlocks, compact = false }: { contentBlocks: ContentBlock[]; compact?: boolean }) {
  const items = contentBlocks.slice(0, compact ? 2 : 4);
  if (items.length === 0) return (
    <Card className="bg-slate-900/60 border-white/10">
      <CardHeader>
        <CardTitle>Contenido destacado</CardTitle>
        <CardDescription>Aquí aparecerán tus bloques de contenido.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm opacity-80">Crea bloques desde la pestaña <strong>Contenido</strong>.</CardContent>
    </Card>
  );
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {items.map((b) => (
        <Card key={b.id} className="bg-slate-900/60 border-white/10">
          <CardHeader>
            <CardTitle>{b.title}</CardTitle>
            <CardDescription>Actualizado {formatDate(b.updatedAt)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{b.body}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------
// Notas de integración con backend
// -----------------------------
// Reemplaza estas funciones mock por llamadas reales a tu API (NestJS, Laravel, Express, etc.).
// Ejemplo:
//  - GET /api/incidents → lista
//  - POST /api/incidents → crear
//  - PATCH /api/incidents/:id → actualizar
//  - DELETE /api/incidents/:id → borrar
//  - POST /api/uploads → subir archivo (devuelve URL pública)
// En producción, elimina localStorage y conecta los handlers (createIncident, updateIncident, ...)
// a tus servicios.
