import { useState, useEffect } from 'react'
import { CellComment } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ChatCircle, CheckCircle, PaperPlaneRight, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CellCommentsProps {
  cellId: string
  comments: CellComment[]
  onAddComment: (text: string, parentId?: string) => void
  onDeleteComment: (commentId: string) => void
  onResolveComment: (commentId: string) => void
  currentUser?: {
    login: string
    avatarUrl: string
  }
}

export function CellComments({ 
  cellId, 
  comments, 
  onAddComment, 
  onDeleteComment, 
  onResolveComment,
  currentUser 
}: CellCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const cellComments = comments.filter(c => c.cellId === cellId && !c.parentId)
  const unresolvedCount = cellComments.filter(c => !c.resolved).length

  const getReplies = (commentId: string) => {
    return comments.filter(c => c.parentId === commentId)
  }

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(newComment)
      setNewComment('')
    }
  }

  const handleAddReply = (parentId: string) => {
    if (replyText.trim()) {
      onAddComment(replyText, parentId)
      setReplyText('')
      setReplyingTo(null)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return date.toLocaleDateString()
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ChatCircle size={18} className="text-accent" />
              Cell Notes & Comments
            </CardTitle>
            <CardDescription>
              Collaborate and document cell logic
            </CardDescription>
          </div>
          {unresolvedCount > 0 && (
            <Badge variant="secondary">
              {unresolvedCount} unresolved
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a note or comment about this cell..."
            className="min-h-20 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleAddComment()
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Cmd+Enter to post
            </p>
            <Button 
              onClick={handleAddComment} 
              size="sm"
              disabled={!newComment.trim()}
            >
              <PaperPlaneRight size={14} className="mr-2" weight="fill" />
              Post Comment
            </Button>
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-[400px] pr-4">
          {cellComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ChatCircle size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No comments yet</p>
              <p className="text-xs mt-1">Add notes to document your cell logic</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cellComments.map((comment) => {
                const replies = getReplies(comment.id)
                
                return (
                  <div
                    key={comment.id}
                    className={cn(
                      'p-4 rounded-lg border bg-card',
                      comment.resolved && 'opacity-60 bg-muted/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={comment.authorAvatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(comment.author)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(comment.timestamp)}
                          </span>
                          {comment.resolved && (
                            <Badge variant="secondary" className="text-xs h-5">
                              <CheckCircle size={12} className="mr-1" weight="fill" />
                              Resolved
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {comment.text}
                        </p>

                        <div className="flex items-center gap-2 mt-3">
                          {!comment.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                              className="h-7 text-xs"
                            >
                              Reply
                            </Button>
                          )}
                          {!comment.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onResolveComment(comment.id)}
                              className="h-7 text-xs"
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Resolve
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteComment(comment.id)}
                            className="h-7 text-xs text-destructive hover:text-destructive"
                          >
                            <Trash size={14} className="mr-1" />
                            Delete
                          </Button>
                        </div>

                        {replyingTo === comment.id && (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply..."
                              className="min-h-16 resize-none text-sm"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => handleAddReply(comment.id)}
                                size="sm"
                                disabled={!replyText.trim()}
                              >
                                Reply
                              </Button>
                              <Button
                                onClick={() => {
                                  setReplyingTo(null)
                                  setReplyText('')
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {replies.length > 0 && (
                          <div className="mt-4 space-y-3 pl-6 border-l-2 border-border">
                            {replies.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={reply.authorAvatar} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(reply.author)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium">{reply.author}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatTimestamp(reply.timestamp)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground whitespace-pre-wrap">
                                    {reply.text}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteComment(reply.id)}
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash size={12} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
          <h4 className="text-xs font-medium mb-2">Example Use Cases</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Document why you chose clean price vs. last price</li>
            <li>• Ask colleagues about yield calculation methodology</li>
            <li>• Note assumptions for future strategy versions</li>
            <li>• Track decisions about callable bond handling</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
