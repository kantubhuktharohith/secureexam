import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis,
} from "recharts";

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const RISK_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

export default function AnalyticsDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [selectedExam, setSelectedExam] = useState<string>("");

  // Fetch all exam sessions for exam list
  const { data: allSessions = [] } = useQuery<any[]>({
    queryKey: ["/api/exam-sessions"],
  });

  // Get unique exam names
  const examNames = Array.from(new Set(allSessions.map((s: any) => s.examName).filter(Boolean))) as string[];

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics/overview", selectedExam],
    queryFn: async () => {
      const url = selectedExam
        ? `/api/analytics/overview?examName=${encodeURIComponent(selectedExam)}`
        : "/api/analytics/overview";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    enabled: true,
  });

  // Fetch score distribution 
  const { data: scoreData } = useQuery<any>({
    queryKey: ["/api/analytics/scores", selectedExam],
    queryFn: async () => {
      if (!selectedExam) return null;
      const res = await fetch(`/api/analytics/scores/${encodeURIComponent(selectedExam)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load scores");
      return res.json();
    },
    enabled: !!selectedExam,
  });

  // Fetch subject performance
  const { data: subjectData } = useQuery<any>({
    queryKey: ["/api/analytics/subjects", selectedExam],
    queryFn: async () => {
      if (!selectedExam) return null;
      const res = await fetch(`/api/analytics/subjects/${encodeURIComponent(selectedExam)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subjects");
      return res.json();
    },
    enabled: !!selectedExam,
  });

  // Fetch cheating report
  const { data: cheatingData } = useQuery<any>({
    queryKey: ["/api/analytics/cheating-report", selectedExam],
    queryFn: async () => {
      if (!selectedExam) return null;
      const res = await fetch(`/api/analytics/cheating-report/${encodeURIComponent(selectedExam)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load cheating report");
      return res.json();
    },
    enabled: !!selectedExam,
  });

  const handleExportCSV = async () => {
    if (!selectedExam) {
      toast({ title: "Select an exam", description: "Choose an exam to export", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/analytics/export/${encodeURIComponent(selectedExam)}`, { credentials: "include" });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedExam}_results.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Exported!", description: "CSV file downloaded successfully" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full shadow-2xl">
          <CardContent className="pt-6 text-center">
            <i className="fas fa-lock text-4xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground mb-4">Admin access required</p>
            <Link href="/"><Button>Return Home</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overview = analyticsData || {
    totalExams: 0,
    totalStudents: 0,
    avgScore: 0,
    passRate: 0,
    totalIncidents: 0,
    avgRiskScore: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-primary">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-white/80">Comprehensive exam performance and proctoring analytics</p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedExam} onValueChange={setSelectedExam}>
              <SelectTrigger className="w-[250px] bg-white/10 text-white border-white/20" data-testid="select-exam-filter">
                <SelectValue placeholder="Select Exam" />
              </SelectTrigger>
              <SelectContent>
                {examNames.map((name: string) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={handleExportCSV} data-testid="button-export-csv">
              <i className="fas fa-download mr-2"></i>Export CSV
            </Button>
            <Link href="/admin/dashboard">
              <Button variant="outline" data-testid="button-dashboard">
                <i className="fas fa-tachometer-alt mr-2"></i>Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={logout}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>Logout
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total Exams", value: overview.totalExams, icon: "fa-file-alt", color: "text-blue-400" },
            { label: "Students", value: overview.totalStudents, icon: "fa-users", color: "text-green-400" },
            { label: "Avg Score", value: `${overview.avgScore}%`, icon: "fa-chart-line", color: "text-purple-400" },
            { label: "Pass Rate", value: `${overview.passRate}%`, icon: "fa-check-circle", color: "text-emerald-400" },
            { label: "Incidents", value: overview.totalIncidents, icon: "fa-exclamation-triangle", color: "text-amber-400" },
            { label: "Avg Risk", value: overview.avgRiskScore, icon: "fa-shield-alt", color: "text-red-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-white/10 backdrop-blur-sm border-white/10">
              <CardContent className="pt-4 pb-4 text-center">
                <i className={`fas ${stat.icon} text-2xl ${stat.color} mb-2`}></i>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/60">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Score Distribution */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-chart-bar text-indigo-500"></i>
                Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoreData?.distribution ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scoreData.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="range" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>{selectedExam ? "Loading..." : "Select an exam to view scores"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pass/Fail Rate */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-chart-pie text-emerald-500"></i>
                Pass/Fail Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoreData?.passFailData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={scoreData.passFailData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {scoreData.passFailData.map((_: any, i: number) => (
                        <Cell key={i} fill={i === 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>{selectedExam ? "Loading..." : "Select an exam to view pass rate"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subject Performance Radar */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-bullseye text-violet-500"></i>
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subjectData?.subjects && subjectData.subjects.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={subjectData.subjects}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" fontSize={12} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={10} />
                    <Radar name="Avg Score %" dataKey="avgScore" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    <Radar name="Accuracy %" dataKey="accuracy" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>{selectedExam ? "No subject data" : "Select an exam"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cheating Risk Heatmap */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-shield-alt text-red-500"></i>
                Cheating Risk Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cheatingData?.students && cheatingData.students.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground font-medium px-1">
                    <div className="col-span-4">Student</div>
                    <div className="col-span-2 text-center">Risk</div>
                    <div className="col-span-2 text-center">Incidents</div>
                    <div className="col-span-4 text-center">Level</div>
                  </div>
                  {cheatingData.students.map((s: any, i: number) => {
                    const riskLevel = s.riskScore > 60 ? 'high' : s.riskScore > 30 ? 'medium' : 'low';
                    return (
                      <div key={i} className="grid grid-cols-12 gap-1 items-center p-2 rounded-lg bg-muted/30 text-sm">
                        <div className="col-span-4 truncate font-medium">{s.studentName}</div>
                        <div className="col-span-2 text-center font-bold" style={{ color: RISK_COLORS[riskLevel] }}>{s.riskScore}</div>
                        <div className="col-span-2 text-center">{s.incidents}</div>
                        <div className="col-span-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                            riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {riskLevel.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <p>{selectedExam ? "No cheating data" : "Select an exam"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Performers Table */}
        <Card className="shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <i className="fas fa-trophy text-amber-500"></i>
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreData?.topPerformers && scoreData.topPerformers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Rank</th>
                      <th className="text-left p-3 font-medium">Student</th>
                      <th className="text-left p-3 font-medium">Roll No.</th>
                      <th className="text-center p-3 font-medium">Score</th>
                      <th className="text-center p-3 font-medium">Total</th>
                      <th className="text-center p-3 font-medium">Percentage</th>
                      <th className="text-center p-3 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreData.topPerformers.map((p: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td className="p-3 font-medium">{p.studentName}</td>
                        <td className="p-3 text-muted-foreground">{p.rollNumber}</td>
                        <td className="p-3 text-center font-bold text-indigo-600">{p.score ?? '-'}</td>
                        <td className="p-3 text-center">{p.totalMarks ?? '-'}</td>
                        <td className="p-3 text-center">
                          {p.score != null && p.totalMarks ? `${Math.round((p.score / p.totalMarks) * 100)}%` : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            (p.riskScore || 0) > 60 ? 'bg-red-100 text-red-700' :
                            (p.riskScore || 0) > 30 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {p.riskScore ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <i className="fas fa-trophy text-4xl mb-4 opacity-30"></i>
                <p>{selectedExam ? "No completed exams with scores" : "Select an exam to view top performers"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incident Trends */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <i className="fas fa-chart-area text-cyan-500"></i>
              Incident Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cheatingData?.trends && cheatingData.trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={cheatingData.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Critical" />
                  <Area type="monotone" dataKey="high" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} name="High" />
                  <Area type="monotone" dataKey="medium" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} name="Medium" />
                  <Area type="monotone" dataKey="low" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Low" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <p>{selectedExam ? "No incident data available" : "Select an exam to view trends"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
