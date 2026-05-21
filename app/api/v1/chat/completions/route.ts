/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';

interface PendingTask {
  taskId: string;
  prompt: string;
  stream: boolean;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED';
  controller?: ReadableStreamDefaultController;
}

// Persist the broker state across Next.js dev server hot-reloads using globalThis
const globalRef = globalThis as any;
if (!globalRef.pendingTasks) {
  globalRef.pendingTasks = new Map<string, PendingTask>();
}
const pendingTasks: Map<string, PendingTask> = globalRef.pendingTasks;

/**
 * Handle OpenAI Client Completions POST Requests
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // ACTION 1: Worker/Host submits a newly generated token
  if (action === 'token') {
    try {
      const { taskId, token } = await req.json();
      const task = pendingTasks.get(taskId);
      
      if (task && task.controller) {
        // Stream the token back to the OpenAI client in standard format
        const chunk = {
          id: `chatcmpl-${taskId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'nexus-compute-llama3',
          choices: [
            {
              index: 0,
              delta: { content: token },
              finish_reason: null
            }
          ]
        };
        
        task.controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // ACTION 2: Worker/Host signals generation is complete
  if (action === 'complete') {
    try {
      const { taskId } = await req.json();
      const task = pendingTasks.get(taskId);
      
      if (task) {
        task.status = 'COMPLETED';
        if (task.controller) {
          // Send final completion marker chunk
          const finalChunk = {
            id: `chatcmpl-${taskId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'nexus-compute-llama3',
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop'
              }
            ]
          };
          task.controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          task.controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          
          try {
            task.controller.close();
          } catch (e) {}
        }
        pendingTasks.delete(taskId);
      }
      
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // STANDARD ACTION: Receive completions request from standard OpenAI client
  try {
    const body = await req.json();
    const { messages, stream = false } = body;
    
    // Format prompt text from message history
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage ? lastMessage.content : '';
    
    const taskId = Math.random().toString(36).substring(7);

    if (stream) {
      // Return highly resilient server-sent text stream
      const customStream = new ReadableStream({
        start(controller) {
          pendingTasks.set(taskId, {
            taskId,
            prompt,
            stream: true,
            status: 'PENDING',
            controller
          });
        },
        cancel() {
          console.log(`[API Gateway] Stream cancelled for task ${taskId}`);
          pendingTasks.delete(taskId);
        }
      });

      return new NextResponse(customStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Non-streaming fallback: wait for tokens to complete (5 seconds mockup response for testing)
      const mockResponse = {
        id: `chatcmpl-${taskId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'nexus-compute-llama3',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `[NexusCompute P2P response] Received prompt: "${prompt}". Cluster computation successfully pooled.`
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: prompt.length / 4,
          completion_tokens: 20,
          total_tokens: (prompt.length / 4) + 20
        }
      };

      return NextResponse.json(mockResponse);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Handle Host/Initiator node queries to fetch pending API completions tasks
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'poll') {
    // Collect all pending tasks
    const tasksList = Array.from(pendingTasks.values())
      .filter(t => t.status === 'PENDING')
      .map(t => {
        t.status = 'RUNNING'; // Mark as executing on browser
        return {
          taskId: t.taskId,
          prompt: t.prompt
        };
      });

    return NextResponse.json({ tasks: tasksList });
  }

  // Simple status check
  return NextResponse.json({
    activeGateway: true,
    pendingTasksCount: pendingTasks.size
  });
}
