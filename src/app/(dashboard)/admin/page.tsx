"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ShieldCheck, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface UserRow {
  id: number; username: string; full_name: string; role: string; created_at: string;
}

const userSchema = z.object({
  username: z.string().min(3, "Min 3 characters"),
  full_name: z.string().min(1, "Full name required"),
  password: z.string().min(6, "Min 6 characters"),
  role: z.enum(["admin", "accountant", "sales_officer"]),
});
type UserForm = z.infer<typeof userSchema>;

const roleConfig = {
  admin: { label: "Administrator", className: "bg-purple-100 text-purple-700" },
  accountant: { label: "Accountant", className: "bg-blue-100 text-blue-700" },
  sales_officer: { label: "Sales Officer", className: "bg-green-100 text-green-700" },
};

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "sales_officer" },
  });

  useEffect(() => {
    if (session && session.user.role !== "admin") {
      toast.error("Access denied");
      router.push("/dashboard");
      return;
    }
    fetchUsers();
  }, [session, router]);

  const fetchUsers = () => {
    setLoading(true);
    fetch("/api/users")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          toast.error(data.error || "Failed to load users");
          setUsers([]);
        } else {
          setUsers(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch(() => { setUsers([]); setLoading(false); });
  };

  const onCreateUser = async (data: UserForm) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("User created successfully");
        setShowDialog(false);
        reset();
        fetchUsers();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create user");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("User deleted");
      fetchUsers();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to delete");
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground">Manage system users and roles</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" />Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Users</CardTitle>
          <CardDescription>{users.length} registered users</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const rc = roleConfig[u.role as keyof typeof roleConfig];
                      return (
                        <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                                {u.full_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{u.full_name}</span>
                              {String(u.id) === session?.user?.id && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">You</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-muted-foreground">@{u.username}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${rc?.className || ""}`}>
                              {rc?.label || u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            {String(u.id) !== session?.user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(u.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {users.map((u) => {
                  const rc = roleConfig[u.role as keyof typeof roleConfig];
                  return (
                    <div key={u.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{u.full_name}</p>
                            {String(u.id) === session?.user?.id && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">You</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">@{u.username}</p>
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium mt-1 ${rc?.className || ""}`}>
                            {rc?.label || u.role}
                          </span>
                        </div>
                      </div>
                      {String(u.id) !== session?.user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(u.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateUser)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="John Doe" {...register("full_name")} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input placeholder="johndoe" {...register("username")} />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" placeholder="Min 6 chars" {...register("password")} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select onValueChange={(v) => setValue("role", v as UserForm["role"])} defaultValue="sales_officer">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_officer">Sales Officer</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowDialog(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
