import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  MessageSquare,
  Pencil,
  Archive,
  Trash2,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ProjectResponse, CreateProjectRequest } from '../../types';
import { projectsApi } from '../../api/projects';
import { Modal, ConfirmModal } from '../../components/ui/Modal';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState<CreateProjectRequest>({
    title: '',
    description: '',
    aiSystemPrompt: '',
    aiTemperature: 0.5,
  });
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await projectsApi.getProjects({ search: searchQuery || undefined });
      setProjects(response.projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.error('Project title is required');
      return;
    }

    try {
      setIsCreating(true);
      const project = await projectsApi.createProject({
        ...createForm,
        description: createForm.description || undefined,
        aiSystemPrompt: createForm.aiSystemPrompt || undefined,
      });
      toast.success('Project created!');
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', aiSystemPrompt: '', aiTemperature: 0.5 });
      navigate(`/projects/${project.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async (projectId: string) => {
    try {
      const project = projects.find((p) => p.id === projectId);
      await projectsApi.updateProject(projectId, { isArchived: !project?.isArchived });
      toast.success(project?.isArchived ? 'Project unarchived' : 'Project archived');
      fetchProjects();
    } catch {
      toast.error('Failed to update project');
    }
    setContextMenu(null);
  };

  const handleDelete = async (projectId: string) => {
    try {
      await projectsApi.deleteProject(projectId);
      toast.success('Project deleted');
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      toast.error('Failed to delete project');
    }
    setShowDeleteConfirm(null);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">My Projects</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-[#1a1a1a] border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 w-64"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:from-violet-500 hover:to-fuchsia-500 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 && !searchQuery ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Create your first project</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Upload study materials and let AI help you learn. Create a personalized learning space with custom AI instructions.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:from-violet-500 hover:to-fuchsia-500 transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Project
          </button>
        </div>
      ) : (
        /* Project Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="group relative bg-[#1a1a1a] border border-gray-800/50 rounded-xl p-5 hover:border-violet-500/30 hover:bg-[#1e1e1e] transition-all cursor-pointer"
            >
              {/* Title & Description */}
              <div className="mb-4">
                <h3 className="text-white font-semibold text-base mb-1 truncate pr-8">
                  {project.title}
                </h3>
                {project.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {project.description}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {project.resourceCount || 0} files
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {project.chatSessionCount || 0} chats
                </span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-600">
                  Updated {formatTimeAgo(project.updatedAt)}
                </span>
                {project.isArchived && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Archived
                  </span>
                )}
              </div>

              {/* Context Menu Trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({ projectId: project.id, x: e.clientX, y: e.clientY });
                }}
                className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-gray-700/50"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add New Card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex flex-col items-center justify-center bg-[#1a1a1a] border border-dashed border-gray-700/50 rounded-xl p-8 hover:border-violet-500/30 hover:bg-[#1e1e1e] transition-all min-h-[160px]"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-3">
              <Plus className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-sm text-gray-400">Create New Project</span>
            <span className="text-xs text-gray-600 mt-1">Start a new study space</span>
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                navigate(`/projects/${contextMenu.projectId}`);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => handleArchive(contextMenu.projectId)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>
                {projects.find((p) => p.id === contextMenu.projectId)?.isArchived
                  ? 'Unarchive'
                  : 'Archive'}
              </span>
            </button>
            <button
              onClick={() => {
                setShowDeleteConfirm(contextMenu.projectId);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
        size="lg"
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="label">Project Title *</label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g. Biology Final Exam Prep"
              className="input w-full"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="What is this project about?"
              className="input w-full resize-none"
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700/50 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-gray-300">AI Configuration</span>
            </div>

            {/* AI Instructions */}
            <div className="mb-4">
              <label className="label">AI Instructions (optional)</label>
              <textarea
                value={createForm.aiSystemPrompt}
                onChange={(e) =>
                  setCreateForm({ ...createForm, aiSystemPrompt: e.target.value })
                }
                placeholder="Tell the AI how you want it to help you..."
                className="input w-full resize-none"
                rows={3}
                maxLength={5000}
              />
              <p className="helper-text mt-1">
                This is like giving your AI tutor a personality
              </p>
            </div>

            {/* Temperature */}
            <div>
              <label className="label">AI Creativity</label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Focused</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={createForm.aiTemperature}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      aiTemperature: parseFloat(e.target.value),
                    })
                  }
                  className="flex-1 accent-violet-500"
                />
                <span className="text-xs text-gray-500">Creative</span>
                <span className="text-xs text-gray-400 w-8 text-right">
                  {createForm.aiTemperature}
                </span>
              </div>
              <p className="helper-text mt-1">
                Lower = more precise answers, Higher = more creative
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !createForm.title.trim()}
              className="btn-primary"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
        title="Delete Project"
        message="Delete this project? All study materials and conversations will be permanently removed. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
